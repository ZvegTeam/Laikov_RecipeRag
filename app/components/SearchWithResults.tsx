"use client";

import type { Recipe } from "@/types/recipe";
import { Box, Button, Stack } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { RecipeDetails } from "./RecipeDetails";
import { RecipeList } from "./RecipeList";
import { SearchForm } from "./SearchForm";

export function SearchWithResults() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailsOpened, setDetailsOpened] = useState(false);
  const [showGoToTop, setShowGoToTop] = useState(false);
  const searchSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = searchSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowGoToTop(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: "0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
      <Box ref={searchSectionRef}>
        <SearchForm onResults={setRecipes} onLoadingChange={setLoading} />
      </Box>
      <RecipeList
        recipes={recipes}
        loading={loading}
        onViewDetails={handleViewDetails}
        emptyMessage="Enter ingredients above and click Search to find recipes."
      />
      <RecipeDetails recipe={selectedRecipe} opened={detailsOpened} onClose={handleCloseDetails} />
      {showGoToTop && (
        <Box
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
          }}
        >
          <Button size="md" onClick={scrollToTop} style={{ minHeight: 44 }} aria-label="Go to top">
            Go to top
          </Button>
        </Box>
      )}
    </Stack>
  );
}
