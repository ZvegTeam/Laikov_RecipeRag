"use client";

import { Alert, Button, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";

export function MainAccessForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Authentication failed");
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to validate password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm" maw={420}>
        <Title order={3} ta="center">
          Protected Access
        </Title>
        <Text c="dimmed">Enter password to access recipe search</Text>
        <PasswordInput
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
        />
        {error && <Alert color="red">{error}</Alert>}
        <Button type="submit" loading={loading}>
          Enter
        </Button>
      </Stack>
    </form>
  );
}
