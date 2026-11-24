import { FormEvent, useState } from "react";
import { LockKeyhole, UserRound } from "lucide-react";

import { apiMessage } from "../api/client";
import CompanyMark from "../components/CompanyMark";
import "./LoginPage.css";

type LoginPageProps = {
  onLogin: (username: string, password: string) => Promise<void>;
  startupError: string;
};

export default function LoginPage({ onLogin, startupError }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(startupError);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(apiMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <CompanyMark className="login-mark" />
        <h1 id="login-title" className="login-screen-reader-title">Sign in</h1>
        <form onSubmit={(event) => void submit(event)}>
          <label className="login-field">
            <span>Username</span>
            <div>
              <UserRound size={17} aria-hidden="true" />
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </label>
          <label className="login-field">
            <span>Password</span>
            <div>
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
