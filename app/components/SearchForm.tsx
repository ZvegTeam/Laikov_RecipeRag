"use client";

import type { Recipe } from "@/types/recipe";
import { Alert, Box, Button, Flex, Stack, Textarea, type TextareaProps } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCallback, useState } from "react";

/** Parse multiline text into non-empty trimmed ingredient strings (one per line). */
function parseIngredients(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SearchFormProps {
  /** Called with search results on success. */
  onResults?: (recipes: Recipe[]) => void;
  /** Called when search request starts or finishes (for loading UI). */
  onLoadingChange?: (loading: boolean) => void;
  /** Placeholder for the ingredients textarea. */
  placeholder?: string;
  /** Minimum height of the textarea. */
  minRows?: TextareaProps["minRows"];
}

export function SearchForm({
  onResults,
  onLoadingChange,
  placeholder = "Enter ingredients, one per line (e.g. chicken, garlic, olive oil)",
  minRows = 4,
}: SearchFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { ingredientsText: "" },
    onSubmitPreventDefault: "always",
    validate: {
      ingredientsText: (value: string) => {
        const ingredients = parseIngredients(value);
        if (ingredients.length === 0) return "Enter at least one ingredient.";
        return null;
      },
    },
  });

  const handleSubmit = useCallback(
    async (values: { ingredientsText: string }) => {
      const ingredients = parseIngredients(values.ingredientsText);
      if (ingredients.length === 0) return;

      setSubmitError(null);
      setLoading(true);
      onLoadingChange?.(true);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients, limit: 20 }),
        });

        const data = await res.json();

        if (!res.ok) {
          const message = data?.error ?? data?.details ?? `Request failed (${res.status})`;
          setSubmitError(message);
          return;
        }

        onResults?.(data.recipes ?? []);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    },
    [onResults, onLoadingChange]
  );

  const handleClear = useCallback(() => {
    form.reset();
    setSubmitError(null);
  }, [form]);

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(handleSubmit)}
      w="100%"
      maw="100%"
      style={{ minWidth: 0 }}
    >
      <Stack gap="md" w="100%">
        <Textarea
          {...form.getInputProps("ingredientsText")}
          label="Ingredients"
          placeholder={placeholder}
          minRows={minRows}
          autosize={minRows === undefined}
          disabled={loading}
          size="md"
          w="100%"
          styles={{
            root: { width: "100%" },
            input: {
              minHeight: 44,
              // Leave space when browser scrolls to focused field (e.g. virtual keyboard)
              scrollMarginBottom: "30vh",
            },
          }}
          aria-describedby={submitError ? "search-form-error" : undefined}
        />

        {submitError && (
          <Alert
            id="search-form-error"
            color="red"
            title="Search failed"
            variant="light"
            withCloseButton
            onClose={() => setSubmitError(null)}
          >
            {submitError}
          </Alert>
        )}

        <Flex gap="sm" direction={{ base: "column", xs: "row" }} wrap="wrap" w="100%">
          <Button
            type="submit"
            loading={loading}
            size="md"
            style={{ minHeight: 44 }}
            w={{ base: "100%", xs: "auto" }}
          >
            Search
          </Button>
          <Button
            type="button"
            variant="default"
            size="md"
            onClick={handleClear}
            disabled={loading}
            style={{ minHeight: 44 }}
            w={{ base: "100%", xs: "auto" }}
          >
            Clear
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
}
