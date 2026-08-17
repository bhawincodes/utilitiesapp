
import React, { useEffect, useState } from 'react';
import axios from "axios";
import { useDispatch, useSelector } from 'react-redux';
import { postUserProfile } from '../store/slices/userSlice';
import { getUserProfilePayload } from '../lib/userProfile';
import "./Home.css";

const CHART_JSON_TOKEN = "<<<CHART_JSON>>>";
const PREVIEW_CHARS = 280;

function splitAskStream(buffer) {
  const index = buffer.indexOf(CHART_JSON_TOKEN);
  if (index === -1) {
    return { answer: buffer, chart: null, jsonReady: false };
  }

  const answer = buffer.slice(0, index).trimEnd();
  const rawJson = buffer.slice(index + CHART_JSON_TOKEN.length).trim();
  if (!rawJson) {
    return { answer, chart: null, jsonReady: false };
  }

  try {
    return { answer, chart: JSON.parse(rawJson), jsonReady: true };
  } catch {
    return { answer, chart: null, jsonReady: false };
  }
}

function AskCharts({ chart }) {
  const domains = chart?.by_domain || [];
  const days = chart?.by_day || [];
  if (!domains.length && !days.length) return null;

  const maxDomainSeconds = Math.max(...domains.map((row) => row.seconds || 0), 1);
  const maxDaySeconds = Math.max(...days.map((row) => row.seconds || 0), 1);

  return (
    <div className="home-charts">
      {domains.length > 0 && (
        <section className="home-chart">
          <h3>Time by domain</h3>
          <ul className="home-chart-bars">
            {domains.map((row) => (
              <li key={row.domain}>
                <div className="home-chart-meta">
                  <span>{row.domain}</span>
                  <span>{row.label}</span>
                </div>
                <div className="home-chart-track">
                  <div
                    className="home-chart-fill"
                    style={{ width: `${Math.max(4, (row.seconds / maxDomainSeconds) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {days.length > 0 && (
        <section className="home-chart">
          <h3>Time by day</h3>
          <ul className="home-chart-bars">
            {days.map((row) => (
              <li key={row.day}>
                <div className="home-chart-meta">
                  <span>{row.day}</span>
                  <span>{row.label}</span>
                </div>
                <div className="home-chart-track">
                  <div
                    className="home-chart-fill home-chart-fill-day"
                    style={{ width: `${Math.max(4, (row.seconds / maxDaySeconds) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Home() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.user.user);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [chart, setChart] = useState(null);
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState([]);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get("http://localhost:8000/ask/history", {
        headers: authHeaders(),
      });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    }
  };
  const handleGoogleLogin = async () => {
    const res = await axios.get("http://localhost:8000/auth/google/url");
    window.location.href = res.data.url;
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:8000/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.data) {
        const payload = getUserProfilePayload(res.data);
        dispatch(postUserProfile(payload));
        fetchHistory();
      }
    } catch (error) {
      try {
        handleGoogleLogin();
      } catch (e) {
        window.location.reload();
      }
    }
  };

  useEffect(() => {
    if(localStorage.getItem("token"))
      fetchProfile();
  }, []);

  const handleAsk = async () => {
    const trimmed = query.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setAnswer("");
    setChart(null);
    setError("");
    setIsExpanded(false);
    setHistory((prev) => [
      { id: `local-${Date.now()}`, query: trimmed, created_at: new Date().toISOString() },
      ...prev.filter((item) => item.query !== trimmed),
    ]);

    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        setError("Request failed.");
        return;
      }

      if (!res.body) {
        setError("Stream failed.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = splitAskStream(buffer);
        setAnswer(parsed.answer);
        if (parsed.jsonReady) {
          setChart(parsed.chart);
        }
      }

      buffer += decoder.decode(); 
      const parsed = splitAskStream(buffer);
      setAnswer(parsed.answer);
      if (parsed.jsonReady) {
        setChart(parsed.chart);
      }
      fetchHistory();
    } catch {
      setError("Stream failed.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAsk();
    }
  };

  return (
    <div>
      {!user && (
        <>
          <h1>Login</h1>
          <button className="google" onClick={handleGoogleLogin}>Sign in with Google</button>
        </>
      )}
      {user && (
        <div className="home-shell">
          <aside className="home-history">
            <h2>Queries</h2>
            {history.length === 0 ? (
              <p className="home-history-empty">No queries yet.</p>
            ) : (
              <ul className="home-history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="home-history-item"
                      onClick={() => setQuery(item.query)}
                      title={item.query}
                    >
                      {item.query}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <div className="home-ask">
          <div className="home-answer">
            {error && <p className="home-error">{error}</p>}
            {!error && answer && (
              <div className="home-answer-body">
                <pre className={`home-answer-text${isExpanded ? "" : " is-collapsed"}`}>
                  {isExpanded || answer.length <= PREVIEW_CHARS
                    ? answer
                    : `${answer.slice(0, PREVIEW_CHARS).trimEnd()}…`}
                </pre>
                {(answer.length > PREVIEW_CHARS || chart) && (
                  <button
                    type="button"
                    className="home-view-toggle"
                    onClick={() => setIsExpanded((open) => !open)}
                  >
                    {isExpanded ? "View less" : "View more"}
                  </button>
                )}
                {isExpanded && chart && <AskCharts chart={chart} />}
              </div>
            )}
            {!error && !answer && isAsking && <p className="home-answer-placeholder">Thinking…</p>}
            {!error && !answer && !isAsking && <p className="home-answer-placeholder">Ask a question below.</p>}
          </div>
          <form
            className="home-composer"
            onSubmit={(event) => {
              event.preventDefault();
              handleAsk();
            }}
          >
            <textarea
              className="home-composer-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask…"
              disabled={isAsking}
              rows={2}
            />
            <button type="submit" disabled={isAsking || !query.trim()}>
              Submit
            </button>
          </form>
        </div>
        </div>
      )}
    </div>
  );
}
