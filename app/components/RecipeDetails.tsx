"use client";

import type { Recipe } from "@/types/recipe";
import {
  Accordion,
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useCallback, useEffect, useState } from "react";

/** Response shape from POST /api/recipe-details */
interface RecipeDetailsData {
  cooking_instructions: string;
  additional_info?: {
    tips?: string[];
    variations?: string[];
    serving_suggestions?: string;
    difficulty?: string;
    nutrition_tips?: string;
  };
  cached?: boolean;
  fetched_at?: string;
}

function formatIngredients(ingredients: string): string[] {
  if (!ingredients.trim()) return [];
  return ingredients
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface RecipeDetailsProps {
  /** Recipe to show (base data from search). */
  recipe: Recipe | null;
  /** When modal should be open. */
  opened: boolean;
  /** Called when user closes the modal. */
  onClose: () => void;
}

export function RecipeDetails({ recipe, opened, onClose }: RecipeDetailsProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [details, setDetails] = useState<RecipeDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const hasInstructionsFromRecipe =
    recipe?.cooking_instructions != null && recipe.cooking_instructions.trim() !== "";
  const needsFetch =
    opened &&
    recipe != null &&
    !hasInstructionsFromRecipe &&
    details == null &&
    !loading &&
    !fetchError;

  const fetchDetails = useCallback(async () => {
    if (!recipe?.id) return;
    setFetchError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/recipe-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data?.error ?? data?.details ?? `Request failed (${res.status})`);
        return;
      }
      setDetails({
        cooking_instructions: data.cooking_instructions ?? "",
        additional_info: data.additional_info ?? {},
        cached: data.cached,
        fetched_at: data.fetched_at,
      });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [recipe?.id]);

  // Pre-fill from recipe if it already has instructions (e.g. from DB cache)
  useEffect(() => {
    if (!opened || !recipe) {
      setDetails(null);
      setFetchError(null);
      return;
    }
    if (hasInstructionsFromRecipe && details == null) {
      setDetails({
        cooking_instructions: recipe.cooking_instructions ?? "",
        additional_info: recipe.additional_info ?? {},
        cached: !!recipe.instructions_fetched_at,
        fetched_at: recipe.instructions_fetched_at,
      });
    }
  }, [opened, recipe, hasInstructionsFromRecipe, details]);

  const instructions = details?.cooking_instructions ?? recipe?.cooking_instructions ?? "";
  const additionalInfo = details?.additional_info ?? recipe?.additional_info;
  const ingredientsList = recipe ? formatIngredients(recipe.ingredients) : [];

  const handleShare = useCallback(async () => {
    if (!recipe) return;
    const text = `${recipe.name}${recipe.url ? ` - ${recipe.url}` : ""}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: recipe.name,
          text: recipe.description ?? text,
          url: recipe.url ?? window.location.href,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await navigator.clipboard?.writeText(recipe.url ?? text);
        }
      }
    } else {
      await navigator.clipboard?.writeText(recipe.url ?? text);
    }
  }, [recipe]);

  if (!recipe) return null;

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      fullScreen={isMobile}
      size="lg"
      radius={isMobile ? 0 : "md"}
      transitionProps={{ duration: 200 }}
      padding={0}
      styles={{
        header: {
          position: isMobile ? "sticky" : undefined,
          top: 0,
          zIndex: 10,
          backgroundColor: "var(--mantine-color-body)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        },
      }}
    >
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header p={{ base: "sm", sm: "md" }}>
          <Modal.Title style={{ fontSize: "1.125rem", lineHeight: 1.3 }}>{recipe.name}</Modal.Title>
          <Modal.CloseButton size="lg" aria-label="Close" />
        </Modal.Header>
        <Modal.Body p={0}>
          <ScrollArea
            style={{ height: isMobile ? "calc(100vh - 60px)" : "70vh" }}
            type="scroll"
            scrollbarSize="sm"
          >
            <Box p={{ base: "sm", sm: "md" }} pb="xl">
              {recipe.image && (
                <Box
                  mb="md"
                  style={{ borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}
                >
                  <Image
                    src={recipe.image}
                    alt={recipe.name}
                    height={isMobile ? 200 : 280}
                    fallbackSrc="https://placehold.co/800x400?text=No+image"
                    loading="lazy"
                    style={{ objectFit: "cover" }}
                  />
                </Box>
              )}

              {recipe.description && (
                <Text size="sm" c="dimmed" mb="md" style={{ fontSize: "1rem" }}>
                  {recipe.description}
                </Text>
              )}

              {(recipe.prep_time || recipe.cook_time || recipe.recipe_yield) && (
                <Group gap="md" mb="md" style={{ fontSize: "1rem" }}>
                  {recipe.prep_time && (
                    <Text size="sm" c="dimmed">
                      Prep: {recipe.prep_time}
                    </Text>
                  )}
                  {recipe.cook_time && (
                    <Text size="sm" c="dimmed">
                      Cook: {recipe.cook_time}
                    </Text>
                  )}
                  {recipe.recipe_yield && (
                    <Text size="sm" c="dimmed">
                      Serves: {recipe.recipe_yield}
                    </Text>
                  )}
                </Group>
              )}

              <Title order={4} mb="xs" style={{ fontSize: "1.125rem" }}>
                Ingredients
              </Title>
              <Text
                component="ul"
                size="sm"
                mb="md"
                pl="md"
                style={{ fontSize: "1rem", lineHeight: 1.6 }}
              >
                {ingredientsList.map((ing, i) => (
                  <li key={`${i}-${ing.slice(0, 30)}`}>{ing}</li>
                ))}
              </Text>

              <Divider my="md" />

              <Title order={4} mb="xs" style={{ fontSize: "1.125rem" }}>
                Cooking instructions
              </Title>
              {loading && (
                <Group gap="sm" py="md">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">
                    Fetching instructions…
                  </Text>
                </Group>
              )}
              {fetchError && (
                <Stack gap="sm" py="md">
                  <Text size="sm" c="red">
                    {fetchError}
                  </Text>
                  <Button
                    variant="light"
                    size="sm"
                    onClick={fetchDetails}
                    style={{ minHeight: 44 }}
                  >
                    Retry
                  </Button>
                </Stack>
              )}
              {needsFetch && !loading && (
                <Button variant="light" size="md" onClick={fetchDetails} style={{ minHeight: 44 }}>
                  Get instructions
                </Button>
              )}
              {instructions && !loading && (
                <Box mb="md">
                  {details?.cached && (
                    <Badge variant="light" size="sm" mb="xs">
                      Cached
                    </Badge>
                  )}
                  <Text
                    component="pre"
                    size="sm"
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                    }}
                  >
                    {instructions}
                  </Text>
                </Box>
              )}

              {additionalInfo &&
                (additionalInfo.tips?.length ||
                  additionalInfo.variations?.length ||
                  additionalInfo.serving_suggestions ||
                  additionalInfo.difficulty ||
                  additionalInfo.nutrition_tips) && (
                  <>
                    <Divider my="md" />
                    <Title order={4} mb="sm" style={{ fontSize: "1.125rem" }}>
                      Additional information
                    </Title>
                    <Accordion
                      variant="separated"
                      radius="md"
                      multiple
                      defaultValue={
                        isMobile ? [] : ["difficulty", "tips", "variations", "serving", "nutrition"]
                      }
                    >
                      {additionalInfo.difficulty && (
                        <Accordion.Item value="difficulty">
                          <Accordion.Control>Difficulty</Accordion.Control>
                          <Accordion.Panel>{additionalInfo.difficulty}</Accordion.Panel>
                        </Accordion.Item>
                      )}
                      {additionalInfo.tips && additionalInfo.tips.length > 0 && (
                        <Accordion.Item value="tips">
                          <Accordion.Control>Cooking tips</Accordion.Control>
                          <Accordion.Panel>
                            <Text component="ul" size="sm" pl="md" style={{ fontSize: "1rem" }}>
                              {additionalInfo.tips.map((tip) => (
                                <li key={tip.slice(0, 80)}>{tip}</li>
                              ))}
                            </Text>
                          </Accordion.Panel>
                        </Accordion.Item>
                      )}
                      {additionalInfo.variations && additionalInfo.variations.length > 0 && (
                        <Accordion.Item value="variations">
                          <Accordion.Control>Recipe variations</Accordion.Control>
                          <Accordion.Panel>
                            <Text component="ul" size="sm" pl="md" style={{ fontSize: "1rem" }}>
                              {additionalInfo.variations.map((v) => (
                                <li key={v.slice(0, 80)}>{v}</li>
                              ))}
                            </Text>
                          </Accordion.Panel>
                        </Accordion.Item>
                      )}
                      {additionalInfo.serving_suggestions && (
                        <Accordion.Item value="serving">
                          <Accordion.Control>Serving suggestions</Accordion.Control>
                          <Accordion.Panel>{additionalInfo.serving_suggestions}</Accordion.Panel>
                        </Accordion.Item>
                      )}
                      {additionalInfo.nutrition_tips && (
                        <Accordion.Item value="nutrition">
                          <Accordion.Control>Nutrition tips</Accordion.Control>
                          <Accordion.Panel>{additionalInfo.nutrition_tips}</Accordion.Panel>
                        </Accordion.Item>
                      )}
                    </Accordion>
                  </>
                )}

              <Stack gap="md" mt="xl">
                {recipe.url && (
                  <Anchor
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    style={{ fontSize: "1rem" }}
                  >
                    Open original recipe
                  </Anchor>
                )}
                <Group gap="sm">
                  <Button
                    variant="default"
                    size="md"
                    leftSection="📤"
                    onClick={handleShare}
                    style={{ minHeight: 44 }}
                  >
                    Share
                  </Button>
                </Group>
              </Stack>
            </Box>
          </ScrollArea>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
