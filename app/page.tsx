import { hasMainPageAccess } from "@/lib/auth/main-access";
import { Center, Container, Stack, Text, Title } from "@mantine/core";
import { cookies } from "next/headers";
import { MainAccessForm } from "./components/MainAccessForm";
import { SearchWithResults } from "./components/SearchWithResults";
import classes from "./page.module.css";

export default function Home() {
  const isAuthenticated = hasMainPageAccess(cookies());

  return (
    <Container size="xl" py="xl" px={{ base: "md", sm: "md", lg: "xl" }}>
      <Stack gap="lg">
        <Title order={1} className={classes.title}>
          Recipe Search Application
        </Title>
        <Text size="lg" c="dimmed" className={classes.text}>
          Find recipes based on ingredients using AI-powered search
        </Text>
        {isAuthenticated ? (
          <SearchWithResults />
        ) : (
          <Center w="100%" py="xl">
            <MainAccessForm />
          </Center>
        )}
      </Stack>
    </Container>
  );
}
