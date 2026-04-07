import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

// POST /create — admin creates a new user with email + password
router.post("/create", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const sb = getServiceClient();

    // Create user via admin API
    const { data: newUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "" },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    return res.json({ userId: newUser.user.id, email: newUser.user.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST / — resolve single email to user_id
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const sb = getServiceClient();
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const user = (data?.users || []).find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ userId: user.id, email: (user as any).email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /batch — resolve multiple user_ids to emails
router.post("/batch", async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: "userIds array is required" });
    }

    const sb = getServiceClient();
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const map: Record<string, string> = {};
    for (const u of (data?.users || []) as any[]) {
      if (userIds.includes(u.id) && u.email) {
        map[u.id] = u.email;
      }
    }

    return res.json({ emails: map });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
