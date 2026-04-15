import { getServiceClient } from "./supabase";
import { calculateNextRunAt } from "../routes/groups-api";

export type SchedulerStatusCode = "waiting" | "processing" | "sent" | "failed" | "missed" | "skipped";

export interface SchedulerDiagnostic {
  status_code: SchedulerStatusCode;
  status_label: string;
  reason_code: string | null;
  reason_label: string | null;
  reason_details: string | null;
  diagnostics: Record<string, any> | null;
  updated_at: string;
}

/**
 * GroupSchedulerManager — In-memory timer-based scheduler.
 *
 * Replaces the 1-minute cron polling with precise setTimeout timers.
 * Each active scheduled message gets exactly one timer.
 * Missed messages (past next_run_at) are NEVER enqueued — only the next
 * future run is calculated and scheduled.
 */
export class GroupSchedulerManager {
  private timers = new Map<string, NodeJS.Timeout>();
  private diagnostics = new Map<string, SchedulerDiagnostic>();

  /** Load all active messages and create timers. Called once on startup. */
  async loadAll(): Promise<void> {
    const sb = getServiceClient();
    const { data: messages, error } = await sb
      .from("group_scheduled_messages")
      .select("id, schedule_type, content, next_run_at, is_active, campaign_id")
      .eq("is_active", true);

    if (error) {
      console.error("[scheduler] loadAll query error:", error.message);
      return;
    }

    if (!messages || messages.length === 0) {
      console.log("[scheduler] No active messages to schedule.");
      return;
    }

    console.log(`[scheduler] Loading ${messages.length} active message(s)...`);
    let scheduled = 0;
    let skippedOnce = 0;
    let recalculated = 0;

    for (const msg of messages) {
      let nextRun = msg.next_run_at ? new Date(msg.next_run_at) : null;
      const now = new Date();

      // If next_run_at is null or in the past, recalculate (DON'T enqueue)
      if (!nextRun || nextRun <= now) {
        if (msg.schedule_type === "once") {
          // Once messages in the past — deactivate, don't fire
          await sb.from("group_scheduled_messages")
            .update({ is_active: false, next_run_at: null })
            .eq("id", msg.id);
          this.setDiagnostic(msg.id, {
            status_code: "missed",
            status_label: "Perdida",
            reason_code: "once_expired_before_start",
            reason_label: "A publicação única expirou antes do disparo",
            reason_details: "O horário agendado já havia passado quando o scheduler carregou essa publicação.",
            diagnostics: { source: "loadAll", next_run_at: msg.next_run_at },
          });
          skippedOnce++;
          continue;
        }

        // Recalculate next future run
        const newNextRun = calculateNextRunAt({ schedule_type: msg.schedule_type, content: msg.content });
        if (!newNextRun) {
          console.warn(`[scheduler] Could not compute next_run for msg ${msg.id} (type=${msg.schedule_type})`);
          this.setDiagnostic(msg.id, {
            status_code: "failed",
            status_label: "Falhou",
            reason_code: "next_run_unavailable",
            reason_label: "Não foi possível calcular o próximo disparo",
            reason_details: `O agendamento recorrente do tipo ${msg.schedule_type} não gerou uma próxima data válida.`,
            diagnostics: { source: "loadAll" },
          });
          continue;
        }

        nextRun = new Date(newNextRun);
        await sb.from("group_scheduled_messages")
          .update({ next_run_at: newNextRun })
          .eq("id", msg.id);
        recalculated++;
      }

      this.createTimer(msg.id, msg.schedule_type, msg.content, msg.campaign_id, nextRun);
      scheduled++;
    }

    console.log(`[scheduler] ✅ Loaded: ${scheduled} timers, ${recalculated} recalculated, ${skippedOnce} expired-once skipped`);
  }

  /** Schedule (or reschedule) a single message. Called from API routes. */
  scheduleMessage(msg: { id: string; schedule_type: string; content: any; campaign_id: string; next_run_at: string | null; is_active: boolean }): void {
    // Cancel existing timer first
    this.cancelMessage(msg.id);

    if (!msg.is_active) {
      this.setDiagnostic(msg.id, {
        status_code: "skipped",
        status_label: "Inativa",
        reason_code: "message_inactive",
        reason_label: "A publicação está desativada",
        reason_details: "O timer foi removido porque a publicação foi marcada como inativa.",
        diagnostics: { source: "scheduleMessage" },
      });
      return;
    }

    if (!msg.next_run_at) {
      this.setDiagnostic(msg.id, {
        status_code: "failed",
        status_label: "Sem horário",
        reason_code: "missing_next_run",
        reason_label: "A publicação ficou sem próximo horário",
        reason_details: "Não existe um próximo disparo definido para esta publicação.",
        diagnostics: { source: "scheduleMessage" },
      });
      return;
    }

    const nextRun = new Date(msg.next_run_at);
    if (nextRun <= new Date()) {
      // Already in the past — skip, don't enqueue
      console.log(`[scheduler] Skipping msg ${msg.id}: next_run already passed`);
      this.setDiagnostic(msg.id, {
        status_code: "missed",
        status_label: "Perdida",
        reason_code: "next_run_already_passed",
        reason_label: "O horário da publicação já havia passado",
        reason_details: "O timer não foi recriado porque o próximo horário já estava vencido no momento do agendamento.",
        diagnostics: { source: "scheduleMessage", next_run_at: msg.next_run_at },
      });
      return;
    }

    this.createTimer(msg.id, msg.schedule_type, msg.content, msg.campaign_id, nextRun);
  }

  /** Cancel a timer for a message. Called when user deletes/deactivates. */
  cancelMessage(msgId: string): void {
    const existing = this.timers.get(msgId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(msgId);
    }
  }

  /** Check if a message has an active timer. */
  hasTimer(msgId: string): boolean {
    return this.timers.has(msgId);
  }

  /** Get the latest diagnostic for a scheduled message. */
  getDiagnostic(msgId: string): SchedulerDiagnostic | null {
    return this.diagnostics.get(msgId) || null;
  }

  /** Get count of active timers (for diagnostics). */
  get activeCount(): number {
    return this.timers.size;
  }

  private setDiagnostic(msgId: string, diagnostic: Omit<SchedulerDiagnostic, "updated_at">): void {
    this.diagnostics.set(msgId, {
      ...diagnostic,
      updated_at: new Date().toISOString(),
    });
  }

  /** Safety sweep: find active messages without timers and recreate them. */
  async safetySweep(): Promise<void> {
    const sb = getServiceClient();
    const { data: active, error } = await sb
      .from("group_scheduled_messages")
      .select("id, schedule_type, content, next_run_at, campaign_id, is_active")
      .eq("is_active", true)
      .not("next_run_at", "is", null);

    if (error || !active) return;

    let fixed = 0;
    const now = new Date();

    for (const msg of active) {
      if (this.timers.has(msg.id)) continue; // Already has a timer

      const nextRun = new Date(msg.next_run_at);
      if (nextRun <= now) {
        // Past — recalculate without enqueuing
        if (msg.schedule_type === "once") {
          await sb.from("group_scheduled_messages")
            .update({ is_active: false, next_run_at: null })
            .eq("id", msg.id);
          this.setDiagnostic(msg.id, {
            status_code: "missed",
            status_label: "Perdida",
            reason_code: "once_expired_during_safety_sweep",
            reason_label: "A publicação única expirou sem processamento",
            reason_details: "A mensagem foi encontrada atrasada durante a verificação de segurança e não entrou na fila.",
            diagnostics: { source: "safetySweep", previous_next_run_at: msg.next_run_at },
          });
          continue;
        }

        const newNextRun = calculateNextRunAt({ schedule_type: msg.schedule_type, content: msg.content });
        if (!newNextRun) {
          this.setDiagnostic(msg.id, {
            status_code: "failed",
            status_label: "Falhou",
            reason_code: "next_run_unavailable",
            reason_label: "Não foi possível calcular o próximo disparo",
            reason_details: "A verificação de segurança encontrou a mensagem atrasada, mas o próximo horário não pôde ser calculado.",
            diagnostics: { source: "safetySweep" },
          });
          continue;
        }

        await sb.from("group_scheduled_messages")
          .update({ next_run_at: newNextRun })
          .eq("id", msg.id);

        this.createTimer(msg.id, msg.schedule_type, msg.content, msg.campaign_id, new Date(newNextRun));
        fixed++;
      } else {
        this.createTimer(msg.id, msg.schedule_type, msg.content, msg.campaign_id, nextRun);
        fixed++;
      }
    }

    if (fixed > 0) {
      console.log(`[scheduler] 🔧 Safety sweep: recreated ${fixed} timer(s). Total active: ${this.timers.size}`);
    }
  }

  // ─── Private ───

  private createTimer(
    msgId: string,
    scheduleType: string,
    content: any,
    campaignId: string,
    nextRun: Date,
    options?: { preserveDiagnostic?: boolean },
  ): void {
    const delayMs = Math.max(nextRun.getTime() - Date.now(), 1000); // min 1s
    
    // Node.js setTimeout max is ~24.8 days (2^31 - 1 ms). For longer delays, chain.
    const MAX_TIMEOUT = 2_147_483_647;
    
    if (delayMs > MAX_TIMEOUT) {
      // Schedule a re-check in 24 hours
      const timer = setTimeout(() => {
        this.timers.delete(msgId);
        this.createTimer(msgId, scheduleType, content, campaignId, nextRun, options);
      }, 24 * 60 * 60 * 1000);
      this.timers.set(msgId, timer);
      if (!options?.preserveDiagnostic) {
        this.setDiagnostic(msgId, {
          status_code: "waiting",
          status_label: "Aguardando",
          reason_code: "timer_long_delay",
          reason_label: "A publicação está aguardando uma janela futura",
          reason_details: "O disparo está a mais de 24 dias de distância, então o scheduler fará rechecagens diárias até chegar a hora.",
          diagnostics: { next_run_at: nextRun.toISOString(), schedule_type: scheduleType },
        });
      }
      console.log(`[scheduler] ⏳ Timer for msg ${msgId}: >24d away, will re-check in 24h`);
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(msgId);
      this.fireMessage(msgId, scheduleType, content, campaignId).catch(err => {
        console.error(`[scheduler] fireMessage error for ${msgId}:`, err.message);
      });
    }, delayMs);

    this.timers.set(msgId, timer);
    if (!options?.preserveDiagnostic) {
      this.setDiagnostic(msgId, {
        status_code: "waiting",
        status_label: "Aguardando",
        reason_code: "timer_active",
        reason_label: "Timer ativo para a próxima execução",
        reason_details: `A publicação está programada para ${nextRun.toISOString()}.`,
        diagnostics: { next_run_at: nextRun.toISOString(), schedule_type: scheduleType, campaign_id: campaignId },
      });
    }

    const runTimeStr = nextRun.toISOString().replace("T", " ").slice(0, 19);
    const delayMin = Math.round(delayMs / 60000);
    console.log(`[scheduler] ⏰ Timer set: msg ${msgId.slice(0, 8)} → ${runTimeStr} UTC (in ${delayMin}min)`);
  }

  private async fireMessage(msgId: string, scheduleType: string, content: any, campaignId: string): Promise<void> {
    const sb = getServiceClient();
    const now = new Date().toISOString();

    console.log(`[scheduler] 🔥 Firing msg ${msgId}`);
    this.setDiagnostic(msgId, {
      status_code: "processing",
      status_label: "Processando",
      reason_code: "dispatch_started",
      reason_label: "A publicação entrou na etapa de despacho",
      reason_details: "O scheduler iniciou a validação da campanha e a montagem da fila.",
      diagnostics: { fired_at: now, campaign_id: campaignId },
    });

    // Re-check message is still active
    const { data: msg, error: msgErr } = await sb
      .from("group_scheduled_messages")
      .select("is_active, schedule_type, content, campaign_id, message_type")
      .eq("id", msgId)
      .single();

    if (msgErr || !msg || !msg.is_active) {
      console.log(`[scheduler] ⏹ Msg ${msgId} no longer active, skipping`);
      this.setDiagnostic(msgId, {
        status_code: "skipped",
        status_label: "Ignorada",
        reason_code: "message_inactive_at_dispatch",
        reason_label: "A publicação ficou inativa antes do disparo",
        reason_details: "No momento da execução, a publicação já não estava mais ativa e por isso foi ignorada.",
        diagnostics: { message_found: !!msg, query_error: msgErr?.message || null },
      });
      return;
    }

    // Fetch campaign
    const { data: campaign, error: campErr } = await sb
      .from("group_campaigns")
      .select("workspace_id, user_id, instance_name, group_jids, is_active")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      console.log(`[scheduler] ⚠️ Campaign ${campaignId} not found for msg ${msgId}, skipping`);
      // Don't deactivate the message — campaign might come back
      this.setDiagnostic(msgId, {
        status_code: "missed",
        status_label: "Perdida",
        reason_code: "campaign_not_found",
        reason_label: "A campanha não foi encontrada no momento da execução",
        reason_details: "A publicação não entrou na fila porque a campanha associada não pôde ser carregada.",
        diagnostics: { campaign_id: campaignId, query_error: campErr?.message || null },
      });
      this.scheduleNext(msgId, scheduleType, content, campaignId);
      return;
    }

    if (!campaign.is_active) {
      console.log(`[scheduler] ⏸ Campaign ${campaignId} is inactive, skipping msg ${msgId} (not deactivating)`);
      this.setDiagnostic(msgId, {
        status_code: "missed",
        status_label: "Perdida",
        reason_code: "campaign_inactive",
        reason_label: "A campanha estava inativa no momento da execução",
        reason_details: "A publicação passou pelo horário, mas não entrou na fila porque a campanha estava pausada.",
        diagnostics: { campaign_id: campaignId },
      });
      this.scheduleNext(msgId, scheduleType, content, campaignId);
      return;
    }

    if (!campaign.group_jids || campaign.group_jids.length === 0) {
      console.log(`[scheduler] ⚠️ Campaign ${campaignId} has no groups, skipping msg ${msgId}`);
      this.setDiagnostic(msgId, {
        status_code: "missed",
        status_label: "Perdida",
        reason_code: "campaign_without_groups",
        reason_label: "A campanha estava sem grupos vinculados",
        reason_details: "A publicação não entrou na fila porque a campanha não tinha grupos-alvo configurados.",
        diagnostics: { campaign_id: campaignId },
      });
      this.scheduleNext(msgId, scheduleType, content, campaignId);
      return;
    }

    // Build queue items with dedup
    const batch = `auto-${Date.now()}-${msgId.slice(0, 8)}`;
    const queueItems: any[] = [];
    const dedupedGroups: string[] = [];

    for (const jid of campaign.group_jids) {
      // Dedup: skip if already queued in the last 5 minutes
      const { count: existing } = await sb
        .from("group_message_queue")
        .select("id", { count: "exact", head: true })
        .eq("scheduled_message_id", msgId)
        .eq("group_jid", jid)
        .in("status", ["pending", "processing", "sent"])
        .gte("created_at", new Date(Date.now() - 5 * 60000).toISOString());

      if ((existing || 0) > 0) {
        console.log(`[scheduler] ⏭ Dedup: msg ${msgId.slice(0, 8)} → ${jid.slice(0, 15)} already queued`);
        dedupedGroups.push(jid);
        continue;
      }

      const { data: sg } = await sb
        .from("group_selected")
        .select("group_name")
        .eq("workspace_id", campaign.workspace_id)
        .eq("group_jid", jid)
        .maybeSingle();

      queueItems.push({
        workspace_id: campaign.workspace_id,
        user_id: campaign.user_id,
        campaign_id: campaignId,
        scheduled_message_id: msgId,
        group_jid: jid,
        group_name: sg?.group_name || "",
        instance_name: campaign.instance_name,
        message_type: msg.message_type || "text",
        content: msg.content,
        status: "pending",
        execution_batch: batch,
      });
    }

    // Only advance schedule if items were actually enqueued
    if (queueItems.length > 0) {
      const { error: insertErr } = await sb.from("group_message_queue").insert(queueItems);
      if (insertErr) {
        console.error(`[scheduler] Insert error for msg ${msgId}:`, insertErr.message);
        this.setDiagnostic(msgId, {
          status_code: "failed",
          status_label: "Falhou",
          reason_code: "queue_insert_failed",
          reason_label: "Falha ao inserir os grupos na fila",
          reason_details: insertErr.message,
          diagnostics: { batch, target_groups: campaign.group_jids.length, queued_groups: queueItems.length },
        });
        // Still try to schedule next
      } else {
        console.log(`[scheduler] ✅ Enqueued ${queueItems.length} items for msg ${msgId.slice(0, 8)} (batch: ${batch})`);
        this.setDiagnostic(msgId, {
          status_code: "processing",
          status_label: "Na fila",
          reason_code: "queued_for_delivery",
          reason_label: "A publicação entrou na fila de envio",
          reason_details: `${queueItems.length} grupo(s) foram adicionados à fila para processamento.`,
          diagnostics: { batch, queued_groups: queueItems.length, deduped_groups: dedupedGroups },
        });
        try {
          const port = process.env.PORT || "3001";
          const processResp = await fetch(`http://localhost:${port}/api/groups/queue/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId: campaign.workspace_id }),
          });

          if (!processResp.ok) {
            const processError = await processResp.text();
            console.error(`[scheduler] queue/process error for ws ${campaign.workspace_id}:`, processError);
            this.setDiagnostic(msgId, {
              status_code: "failed",
              status_label: "Falhou",
              reason_code: "queue_process_http_error",
              reason_label: "Falha ao disparar o processador da fila",
              reason_details: processError,
              diagnostics: { batch, workspace_id: campaign.workspace_id },
            });
          }
        } catch (processErr: any) {
          console.error(`[scheduler] queue/process fetch error for ws ${campaign.workspace_id}:`, processErr.message);
          this.setDiagnostic(msgId, {
            status_code: "failed",
            status_label: "Falhou",
            reason_code: "queue_process_fetch_error",
            reason_label: "Erro ao chamar o processador da fila",
            reason_details: processErr.message,
            diagnostics: { batch, workspace_id: campaign.workspace_id },
          });
        }
      }

      // Update last_run_at
      const updateData: any = { last_run_at: now };

      if (scheduleType === "once") {
        updateData.is_active = false;
        updateData.next_run_at = null;
        await sb.from("group_scheduled_messages").update(updateData).eq("id", msgId);
        console.log(`[scheduler] ⏹ Once msg ${msgId.slice(0, 8)} completed and deactivated`);
        return;
      }

      // Calculate next run
      const nextRun = calculateNextRunAt({ schedule_type: scheduleType, content: msg.content });
      if (nextRun) {
        updateData.next_run_at = nextRun;
        await sb.from("group_scheduled_messages").update(updateData).eq("id", msgId);
        // Schedule next timer
        this.createTimer(msgId, scheduleType, msg.content, campaignId, new Date(nextRun), { preserveDiagnostic: true });
      } else {
        updateData.is_active = false;
        updateData.next_run_at = null;
        await sb.from("group_scheduled_messages").update(updateData).eq("id", msgId);
        this.setDiagnostic(msgId, {
          status_code: "failed",
          status_label: "Falhou",
          reason_code: "next_run_unavailable",
          reason_label: "Não foi possível calcular o próximo disparo",
          reason_details: "A publicação executou a etapa atual, mas o próximo horário não pôde ser calculado e ela foi desativada.",
          diagnostics: { campaign_id: campaignId },
        });
        console.warn(`[scheduler] ⚠️ Could not compute next run for msg ${msgId}, deactivated`);
      }
    } else {
      console.log(`[scheduler] ⚠️ 0 items enqueued for msg ${msgId.slice(0, 8)} (all deduped). NOT advancing schedule.`);
      this.setDiagnostic(msgId, {
        status_code: "skipped",
        status_label: "Ignorada",
        reason_code: dedupedGroups.length > 0 ? "dedup_all_groups" : "queue_items_empty",
        reason_label: dedupedGroups.length > 0
          ? "Bloqueada por deduplicação de 5 minutos"
          : "Nenhum item foi gerado para envio",
        reason_details: dedupedGroups.length > 0
          ? `Todos os ${dedupedGroups.length} grupo(s) desta execução já tinham uma mensagem igual na janela de 5 minutos.`
          : "A publicação passou pelo scheduler, mas nenhum grupo elegível foi montado para a fila.",
        diagnostics: { deduped_groups: dedupedGroups, campaign_id: campaignId },
      });
      // Re-schedule the next run without consuming this one
      this.scheduleNext(msgId, scheduleType, msg.content, campaignId);
    }
  }

  /** Schedule the next timer for a recurring message without advancing last_run_at. */
  private async scheduleNext(msgId: string, scheduleType: string, content: any, campaignId: string): Promise<void> {
    if (scheduleType === "once") return;

    const nextRun = calculateNextRunAt({ schedule_type: scheduleType, content });
    if (nextRun) {
      const sb = getServiceClient();
      await sb.from("group_scheduled_messages")
        .update({ next_run_at: nextRun })
        .eq("id", msgId);
      this.createTimer(msgId, scheduleType, content, campaignId, new Date(nextRun), { preserveDiagnostic: true });
    } else {
      this.setDiagnostic(msgId, {
        status_code: "failed",
        status_label: "Falhou",
        reason_code: "next_run_unavailable",
        reason_label: "Não foi possível calcular o próximo disparo",
        reason_details: "O scheduler tentou reagendar a publicação, mas não encontrou um próximo horário válido.",
        diagnostics: { campaign_id: campaignId, schedule_type: scheduleType },
      });
    }
  }
}

// Singleton instance
export const groupScheduler = new GroupSchedulerManager();
