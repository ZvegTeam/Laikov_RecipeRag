"use client";

import type { Recipe } from "@/types/recipe";
import { Box, Button, Card, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { RecipeCard } from "./RecipeCard";

/** Skeleton placeholder matching RecipeCard layout for loading state */
function RecipeCardSkeleton() {
  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      w="100%"
      maw="100%"
      style={{ minWidth: 0 }}
    >
      <Card.Section>
        <Skeleton height={200} />
      </Card.Section>
      <Stack gap="sm" mt="sm">
        <Skeleton height={28} width="80%" radius="sm" />
        <Skeleton height={16} width="100%" radius="sm" />
        <Skeleton height={16} width="90%" radius="sm" />
        <Skeleton height={16} width="70%" radius="sm" />
        <Box style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <Skeleton height={36} width={100} radius="sm" />
          <Skeleton height={36} width={120} radius="sm" />
        </Box>
      </Stack>
    </Card>
  );
}

/** Number of skeleton cards (fewer visible on mobile due to single column) */
const SKELETON_COUNT = 6;
const SKELETON_KEYS = [
  "recipe-list-skeleton-a",
  "recipe-list-skeleton-b",
  "recipe-list-skeleton-c",
  "recipe-list-skeleton-d",
  "recipe-list-skeleton-e",
  "recipe-list-skeleton-f",
] as const;

export interface RecipeListProps {
  /** Recipe items to display */
  recipes: Recipe[];
  /** Show loading skeletons instead of list */
  loading?: boolean;
  /** Called when user clicks "View Details" on a card */
  onViewDetails?: (recipe: Recipe) => void;
  /** Message when there are no recipes and not loading (e.g. "Enter ingredients and search") */
  emptyMessage?: React.ReactNode;
  /** Whether more results are available; show "Load more" when true */
  hasMore?: boolean;
  /** Called when user clicks "Load more" */
  onLoadMore?: () => void;
  /** Whether "Load more" request is in progress */
  loadingMore?: boolean;
  /** Optional refresh handler (e.g. re-run search); show refresh control when set */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  refreshing?: boolean;
}

export function RecipeList({
  recipes,
  loading = false,
  onViewDetails,
  emptyMessage = "No recipes found. Try different ingredients.",
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  onRefresh,
  refreshing = false,
}: RecipeListProps) {
  if (loading) {
    return (
      <SimpleGrid
        cols={{ base: 1, lg: 2, xl: 3 }}
        spacing="md"
        verticalSpacing="md"
        style={{ scrollBehavior: "smooth" }}
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <RecipeCardSkeleton key={SKELETON_KEYS[i]} />
        ))}
      </SimpleGrid>
    );
  }

  if (recipes.length === 0) {
    return (
      <Stack gap="md" py="xl" align="center">
        <Text size="lg" c="dimmed" ta="center" maw={400}>
          {emptyMessage}
        </Text>
        {onRefresh && (
          <Button
            variant="light"
            loading={refreshing}
            onClick={onRefresh}
            style={{ minHeight: 44 }}
          >
            Refresh
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <SimpleGrid
        cols={{ base: 1, lg: 2, xl: 3 }}
        spacing="md"
        verticalSpacing="md"
        style={{ scrollBehavior: "smooth" }}
      >
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} onViewDetails={onViewDetails} />
        ))}
      </SimpleGrid>
      {hasMore && onLoadMore && (
        <Box ta="center" py="md">
          <Button
            variant="light"
            size="md"
            loading={loadingMore}
            onClick={onLoadMore}
            style={{ minHeight: 44 }}
          >
            Load more
          </Button>
        </Box>
      )}
    </Stack>
  );
}
