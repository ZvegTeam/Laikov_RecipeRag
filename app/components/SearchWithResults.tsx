"use client";

import type { Recipe } from "@/types/recipe";
import { SimpleGrid, Stack } from "@mantine/core";
import { useState } from "react";
import { RecipeCard } from "./RecipeCard";
import { RecipeDetails } from "./RecipeDetails";
import { SearchForm } from "./SearchForm";

export function SearchWithResults() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailsOpened, setDetailsOpened] = useState(false);

  const handleViewDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setDetailsOpened(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpened(false);
    setSelectedRecipe(null);
  };

  return (
    <Stack gap="lg">
      <SearchForm onResults={setRecipes} />
      {recipes.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 1, md: 2, lg: 3 }} spacing="md" verticalSpacing="md">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onViewDetails={handleViewDetails} />
          ))}
        </SimpleGrid>
      )}
      <RecipeDetails recipe={selectedRecipe} opened={detailsOpened} onClose={handleCloseDetails} />
    </Stack>
  );
}
