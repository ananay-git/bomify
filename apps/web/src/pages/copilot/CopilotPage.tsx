/**
 * CopilotPage — AI-powered chat interface with persistent Multi-Thread History.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Typography, Input, Button, Tooltip, Tag, Layout, Menu } from "antd";
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  CodeOutlined,
  BarChartOutlined,
  BulbOutlined,
  MessageOutlined,
  PlusOutlined
} from "@ant-design/icons";
import Plot from "react-plotly.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  askCopilot,
  fetchChart,
  fetchThreads,
  fetchThreadHistory,
  type PlotlyFigure,
  type CopilotThreadResponse
} from "@/features/copilot/api/copilot";

const { Text } = Typography;
const { TextArea } = Input;
const { Sider, Content } = Layout;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  generatedSql?: string | null;
  chartIds?: string[];
  charts?: PlotlyFigure[];
  loading?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  "Which vendor delays the most?",
  "Show me sales orders created this month",
  "What's the current stock of all inventory items?",
  "Show a bar chart of production output by machine",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ThinkingDots() {
  return (
    <span className="copilot-thinking">
      <span /><span /><span />
    </span>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12,
          color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        <CodeOutlined />
        {open ? "Hide SQL" : "View SQL"}
      </button>
      {open && (
        <pre style={{
          marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#0f172a",
          color: "#7dd3fc", fontSize: 12, lineHeight: 1.6, overflowX: "auto",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
          border: "1px solid rgba(51, 65, 85, 0.6)",
        }}>
          {sql}
        </pre>
      )}
    </div>
  );
}

function ChartView({ figure }: { figure: PlotlyFigure }) {
  const customLayout = { ...(figure.layout as any) };
  let titleText = "";
  if (customLayout.title) {
    if (typeof customLayout.title === "string") titleText = customLayout.title;
    else if (customLayout.title.text) titleText = customLayout.title.text;
    delete customLayout.title;
  }
  return (
    <div style={{
      marginTop: 12, borderRadius: 12, overflow: "hidden",
      border: "1px solid rgba(51, 65, 85, 0.25)", background: "#fff",
    }}>
      {titleText && (
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #f1f5f9",
          background: "#f8fafc", fontWeight: 600, fontSize: 13, color: "#1e293b",
        }}>
          {titleText}
        </div>
      )}
      <Plot
        data={figure.data as Plotly.Data[]}
        layout={{
          ...customLayout, autosize: true,
          margin: { t: titleText ? 24 : 40, r: 20, b: 40, l: 50 },
          paper_bgcolor: "#ffffff", plot_bgcolor: "#f8fafc",
          font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#374151" },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", minHeight: 320 }}
        useResizeHandler
      />
    </div>
  );
}

function MarkdownBody({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
        h1: ({ children }) => <h1 style={{ fontSize: 18, margin: "6px 0" }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: 16, margin: "6px 0" }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: 15, margin: "6px 0" }}>{children}</h3>,
        code: ({ children, ...props }) => {
          const inline = !(props as { className?: string }).className;
          return inline ? (
            <code style={{
              background: "#f1f5f9", padding: "1px 5px", borderRadius: 4,
              fontSize: 13, fontFamily: "ui-monospace, Menlo, monospace",
            }}>{children}</code>
          ) : (
            <code style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>{children}</code>
          );
        },
        pre: ({ children }) => (
          <pre style={{
            background: "#0f172a", color: "#e2e8f0", padding: 10, borderRadius: 6,
            overflowX: "auto", margin: "6px 0", fontSize: 13,
          }}>{children}</pre>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "6px 0" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ border: "1px solid #e2e8f0", padding: "4px 8px", background: "#f8fafc", textAlign: "left" }}>{children}</th>
        ),
        td: ({ children }) => (
          <td style={{ border: "1px solid #e2e8f0", padding: "4px 8px" }}>{children}</td>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>{children}</a>
        ),
        blockquote: ({ children }) => (
          <blockquote style={{
            borderLeft: "3px solid #cbd5e1", margin: "6px 0", padding: "2px 10px", color: "#475569",
          }}>{children}</blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start", gap: 10,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isUser
          ? "linear-gradient(135deg, #0ea5e9, #3b82f6)"
          : "linear-gradient(135deg, #3b82f6, #6366f1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}>
        {isUser
          ? <UserOutlined style={{ color: "#fff", fontSize: 15 }} />
          : <RobotOutlined style={{ color: "#fff", fontSize: 15 }} />}
      </div>

      <div style={{ maxWidth: "75%", minWidth: 0 }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          background: isUser
            ? "linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)"
            : "#fff",
          color: isUser ? "#fff" : "#1e293b",
          fontSize: 14, lineHeight: 1.65,
          boxShadow: isUser
            ? "0 4px 14px rgba(79, 70, 229, 0.25)"
            : "0 2px 8px rgba(0,0,0,0.07)",
          border: isUser ? "none" : "1px solid #f1f5f9",
        }}>
          {msg.loading ? (
            <ThinkingDots />
          ) : msg.error ? (
            <Text type="danger">{msg.text}</Text>
          ) : isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
          ) : (
            <MarkdownBody text={msg.text} />
          )}
        </div>

        {!isUser && !msg.loading && (
          <>
            {msg.generatedSql && <SqlBlock sql={msg.generatedSql} />}
            {msg.charts && msg.charts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                  fontSize: 12, color: "#64748b", fontWeight: 500,
                }}>
                  <BarChartOutlined />
                  {msg.charts.length === 1 ? "Generated chart" : `${msg.charts.length} charts generated`}
                </div>
                {msg.charts.map((fig, i) => <ChartView key={i} figure={fig} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const WELCOME_MSG: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I'm QuadStack Copilot. Ask me anything about your operations — inventory, sales, production, purchases, or dispatch. I can also generate charts for you.",
};

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Monotonic counter for collision-free message IDs
  const msgIdCounter = useRef(0);
  const nextMsgId = useCallback(() => `msg-${++msgIdCounter.current}-${Date.now()}`, []);

  // Sidebar state
  const [threads, setThreads] = useState<CopilotThreadResponse[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);

  // Auto scroll
  useEffect(() => {
    if (bottomRef.current) {
      const container = bottomRef.current.closest(".copilot-scroll");
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }
  }, [messages]);

  const loadThreads = useCallback(async () => {
    try {
      const data = await fetchThreads();
      setThreads(data);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleThreadSelect = async (id: string) => {
    if (id === activeThreadId || busy) return;
    setActiveThreadId(id);
    setBusy(true);
    try {
      const history = await fetchThreadHistory(id);
      const ts = Date.now();
      const loadedMessages: ChatMessage[] = await Promise.all(
        history.map(async (m, i) => {
          let charts: PlotlyFigure[] = [];
          if (m.chart_ids && m.chart_ids.length > 0) {
            charts = await Promise.all(m.chart_ids.map((cid: string) => fetchChart(cid)));
          }
          return {
            id: `history-${id}-${i}-${ts}`,   // ts suffix prevents reuse collision
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            text: m.content,
            generatedSql: m.sql_query ?? null,
            chartIds: m.chart_ids ?? [],
            charts,
          };
        })
      );
      setMessages([WELCOME_MSG, ...loadedMessages]);
      setThreadId(id);
    } catch (err) {
      console.error("Failed to load thread history:", err);
      setActiveThreadId(threadId);
    } finally {
      setBusy(false);
    }
  };

  const handleNewChat = () => {
    setThreadId(undefined);
    setActiveThreadId(undefined);
    setMessages([WELCOME_MSG]);
  };

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || busy) return;

      const userMsgId = nextMsgId();
      const loadingId = nextMsgId();

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: "user",
        text: query.trim(),
      };
      const loadingMsg: ChatMessage = {
        id: loadingId,
        role: "assistant",
        text: "",
        loading: true,
        charts: [],
        generatedSql: null,
        chartIds: [],
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setInput("");
      setBusy(true);

      const isFirstMessage = !threadId;

      try {
        const response = await askCopilot(query.trim(), threadId);

        if (response.thread_id) {
          setThreadId(response.thread_id);
          setActiveThreadId(response.thread_id);
          if (isFirstMessage) {
            setTimeout(() => loadThreads(), 600);
          }
        }

        const charts: PlotlyFigure[] = await Promise.all(
          (response.chart_files ?? []).map((id) => fetchChart(id))
        );

        // Fully explicit — no spread, nothing leaks from placeholder or prior messages
        const finalMsg: ChatMessage = {
          id: loadingId,
          role: "assistant",
          loading: false,
          error: false,
          text: response.natural_language_summary,
          generatedSql: response.generated_sql ?? null,
          chartIds: response.chart_files ?? [],
          charts,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? finalMsg : m))
        );
      } catch (err: unknown) {
        const message =
          (err as any)?.response?.data?.detail ||
          "Something went wrong. Please try again.";

        const errorMsg: ChatMessage = {
          id: loadingId,
          role: "assistant",
          loading: false,
          error: true,
          text: message,
          generatedSql: null,
          chartIds: [],
          charts: [],
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? errorMsg : m))
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, threadId, loadThreads, nextMsgId]
  );

  return (
    <Layout style={{
      flex: 1, minHeight: 0, height: "calc(100vh - 64px)", maxHeight: "calc(100vh - 64px)",
      background: "#fff", display: "flex", flexDirection: "row",
      borderRadius: "16px", overflow: "hidden", border: "1px solid #e2e8f0",
    }}>

      {/* Sidebar */}
      <Sider width={280} theme="light" style={{
        borderRight: "1px solid #e2e8f0", display: "flex",
        flexDirection: "column", background: "#f8fafc",
      }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
          <Button
            type="primary" block icon={<PlusOutlined />} onClick={handleNewChat}
            style={{ height: 40, borderRadius: 8, background: "#1e293b" }}
          >
            New Conversation
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }} className="copilot-scroll">
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase",
            padding: "0 12px 10px", letterSpacing: "0.05em",
          }}>
            Recent Conversations
          </div>
          {threadsLoading ? (
            <div style={{ padding: "0 12px", color: "#94a3b8", fontSize: 13 }}>Loading...</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: "0 12px", color: "#94a3b8", fontSize: 13 }}>No previous sessions found.</div>
          ) : (
            <Menu
              mode="inline"
              selectedKeys={activeThreadId ? [activeThreadId] : []}
              style={{ borderRight: "none", background: "transparent" }}
              onClick={({ key }) => handleThreadSelect(key)}
              items={threads.map((t) => ({
                key: t.thread_id,
                icon: <MessageOutlined />,
                label: t.title || "New Conversation",
                style: { borderRadius: 8, margin: "4px 0" },
              }))}
            />
          )}
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{
        display: "flex", flexDirection: "column", flex: 1,
        minHeight: 0, minWidth: 0, background: "#fff",
      }}>
        <div style={{
          padding: "18px 28px", borderBottom: "1px solid #e2e8f0", background: "#fff",
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
          }}>
            <RobotOutlined style={{ color: "#fff", fontSize: 20 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", lineHeight: 1.2 }}>
              QuadStack Copilot
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>AI-powered analytics assistant</div>
          </div>
          <Tag color="green" style={{ marginLeft: "auto", fontSize: 11, borderRadius: 20 }}>Online</Tag>
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column" }}
          className="copilot-scroll"
        >
          <div style={{
            maxWidth: 820, width: "100%", margin: "0 auto", padding: "0 20px",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {messages.length === 1 && (
          <div style={{ padding: "0 20px 16px", maxWidth: 880, width: "100%", margin: "0 auto" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
              color: "#94a3b8", fontSize: 12, fontWeight: 500,
            }}>
              <BulbOutlined /> Try asking:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s} onClick={() => sendMessage(s)} disabled={busy}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: "1px solid #e2e8f0",
                    background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer",
                    transition: "all 0.15s ease", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.color = "#3b82f6";
                    e.currentTarget.style.background = "#eff6ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.color = "#475569";
                    e.currentTarget.style.background = "#fff";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{
          padding: "16px 20px 20px", borderTop: "1px solid #e2e8f0",
          background: "#fff", flexShrink: 0,
        }}>
          <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
              placeholder="Ask about operations, inventory, sales... (Enter to send, Shift+Enter for newline)"
              autoSize={{ minRows: 1, maxRows: 5 }}
              disabled={busy}
              style={{
                flex: 1, borderRadius: 12, fontSize: 14, border: "1px solid #e2e8f0",
                boxShadow: "none", resize: "none", padding: "10px 14px",
              }}
            />
            <Tooltip title="Send (Enter)">
              <Button
                type="primary" shape="circle" icon={<SendOutlined />}
                onClick={() => sendMessage(input)} loading={busy}
                disabled={!input.trim() || busy} size="large"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                  border: "none", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)", flexShrink: 0,
                }}
              />
            </Tooltip>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
            Copilot has read-only access to your database. It cannot modify any data.
          </div>
        </div>

        <style>{`
          .copilot-scroll { scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.3) transparent; }
          .copilot-scroll::-webkit-scrollbar { width: 6px; }
          .copilot-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 3px; }
          .copilot-thinking { display: inline-flex; align-items: center; gap: 4px; }
          .copilot-thinking span { display: block; width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: copilot-bounce 1.2s infinite ease-in-out; }
          .copilot-thinking span:nth-child(2) { animation-delay: 0.2s; }
          .copilot-thinking span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes copilot-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
          .ant-menu-light .ant-menu-item-selected { background-color: #f1f5f9; color: #0f172a; font-weight: 500; }
          .ant-menu-item { color: #475569; font-size: 13px; margin: 4px 8px; width: calc(100% - 16px); }
          .ant-menu-item:hover { color: #0f172a; background-color: #f8fafc; }
        `}</style>
      </Content>
    </Layout>
  );
}