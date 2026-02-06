import { Container, Stack, Text, Title } from "@mantine/core";
import { SearchForm } from "./components/SearchForm";
import classes from "./page.module.css";

export default function Home() {
  return (
    <Container size="xl" py="xl" px={{ base: "sm", sm: "md", lg: "xl" }}>
      <Stack gap="lg">
        <Title order={1} className={classes.title}>
          Recipe Search Application
        </Title>
        <Text size="lg" c="dimmed" className={classes.text}>
          Find recipes based on ingredients using AI-powered search
        </Text>
        <SearchForm />
      </Stack>
    </Container>
  );
}
