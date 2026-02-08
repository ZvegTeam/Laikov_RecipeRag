"use client";

import type { Recipe } from "@/types/recipe";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Image,
  Spoiler,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ExternalLink } from "lucide-react";

/** Split recipe ingredients string into list items (by newline or comma). */
function formatIngredients(ingredients: string): string[] {
  if (!ingredients.trim()) return [];
  return ingredients
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface RecipeCardProps {
  recipe: Recipe;
  /** Called when "View Details" is clicked (e.g. open modal). */
  onViewDetails?: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, onViewDetails }: RecipeCardProps) {
  const [ingredientsOpen, { toggle: toggleIngredients }] = useDisclosure(false);
  const ingredientsList = formatIngredients(recipe.ingredients);
  const hasMeta = recipe.prep_time || recipe.cook_time || recipe.recipe_yield;

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      w="100%"
      maw="100%"
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Card.Section style={{ flexShrink: 0 }}>
        <Image
          src={recipe.image}
          alt={recipe.name}
          height={200}
          fallbackSrc="https://placehold.co/400x200?text=No+image"
          loading="lazy"
          style={{ objectFit: "cover" }}
        />
      </Card.Section>

      <Stack
        gap="sm"
        mt="sm"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Title
            order={3}
            size="h4"
            lineClamp={2}
            style={{ fontSize: "1.25rem", minHeight: "1.5rem" }}
          >
            {recipe.name}
          </Title>
          {recipe.similarity != null && (
            <Badge variant="light" size="sm" style={{ flexShrink: 0 }}>
              {Math.round(recipe.similarity * 100)}% match
            </Badge>
          )}
        </Group>

        {recipe.description && (
          <Box component="span" style={{ fontSize: "1rem" }}>
            <Spoiler
              maxHeight={80}
              showLabel="Read more"
              hideLabel="Show less"
              initialState={false}
            >
              <Text size="sm" c="dimmed" lineClamp={3}>
                {recipe.description}
              </Text>
            </Spoiler>
          </Box>
        )}

        {hasMeta && (
          <Group gap="md" style={{ fontSize: "1rem" }}>
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

        {/* Ingredients: collapsible section */}
        {ingredientsList.length > 0 && (
          <Box>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={toggleIngredients}
              style={{ minHeight: 44, fontSize: "1rem" }}
            >
              {ingredientsOpen ? "Hide ingredients" : "Show ingredients"}
            </Button>
            <Collapse in={ingredientsOpen}>
              <Text
                component="ul"
                size="sm"
                c="dimmed"
                mt="xs"
                pl="md"
                style={{ fontSize: "1rem" }}
              >
                {ingredientsList.slice(0, 8).map((ing, i) => (
                  <li key={`${i}-${ing.slice(0, 20)}`}>{ing}</li>
                ))}
                {ingredientsList.length > 8 && (
                  <li key="more">… and {ingredientsList.length - 8} more</li>
                )}
              </Text>
            </Collapse>
          </Box>
        )}

        <Group gap="sm" mt="auto" style={{ flexShrink: 0 }}>
          {recipe.url && (
            <Tooltip label="Open original recipe">
              <ActionIcon
                component="a"
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="light"
                size="lg"
                aria-label="Open original recipe"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <ExternalLink size={20} />
              </ActionIcon>
            </Tooltip>
          )}
          <Button
            variant="light"
            size="md"
            onClick={() => onViewDetails?.(recipe)}
            style={{ minHeight: 44 }}
          >
            View Details
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
