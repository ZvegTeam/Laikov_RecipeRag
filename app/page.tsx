import { Container, Stack, Text, Title } from "@mantine/core";

export default function Home() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Title order={1}>Recipe Search Application</Title>
        <Text size="lg" c="dimmed">
          Find recipes based on ingredients using AI-powered search
        </Text>
      </Stack>
    </Container>
  );
}
