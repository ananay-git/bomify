/**
 * Copilot API — types and API call functions.
 */

import api from "@/lib/axios";

export interface CopilotQueryResponse {
  natural_language_summary: string;
  generated_sql: string | null;
  chart_files: string[]; // chart IDs — fetch via GET /copilot/charts/{id}
  thread_id: string; // Used to track memory/context
}

export interface CopilotThreadResponse {
  id: number;
  thread_id: string;
  title: string;
  created_at: string;
}

export interface CopilotMessageDto {
  role: "user" | "agent";
  content: string;
  chart_ids: string[];
  sql_query: string | null;
}

export interface PlotlyFigure {
  data: object[];
  layout: object;
}

export async function askCopilot(
  query: string,
  thread_id?: string
): Promise<CopilotQueryResponse> {
  const res = await api.post<CopilotQueryResponse>("/copilot/ask", { 
    query, 
    thread_id 
  });
  return res.data;
}

export async function fetchChart(chartId: string): Promise<PlotlyFigure> {
  const res = await api.get<PlotlyFigure>(`/copilot/charts/${chartId}`);
  return res.data;
}

export async function fetchThreads(): Promise<CopilotThreadResponse[]> {
  const res = await api.get<CopilotThreadResponse[]>("/copilot/threads");
  return res.data;
}

export async function fetchThreadHistory(thread_id: string): Promise<CopilotMessageDto[]> {
  const res = await api.get<CopilotMessageDto[]>(`/copilot/threads/${thread_id}/history`);
  return res.data;
}
