import { Router } from "express";
import { getServiceClient } from "../lib/supabase";

const router = Router();

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

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ userId: user.id, email: user.email });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
