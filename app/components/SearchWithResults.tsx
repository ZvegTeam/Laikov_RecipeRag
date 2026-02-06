"use client";

import type { Recipe } from "@/types/recipe";
import { SimpleGrid, Stack } from "@mantine/core";
import { useState } from "react";
import { RecipeCard } from "./RecipeCard";
import { SearchForm } from "./SearchForm";

export function SearchWithResults() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  return (
    <Stack gap="lg">
      <SearchForm onResults={setRecipes} />
      {recipes.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 1, md: 2, lg: 3 }} spacing="md" verticalSpacing="md">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onViewDetails={() => {
                // TODO: open RecipeDetails modal (4.3.1)
              }}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
