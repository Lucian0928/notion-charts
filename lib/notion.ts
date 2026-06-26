import { Client } from "@notionhq/client";

export function getNotionClient(token: string) {
  return new Client({ auth: token });
}

export function getServerToken(): string | undefined {
  return process.env.NOTION_CHARTS_TOKEN;
}
