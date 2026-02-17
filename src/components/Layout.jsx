import { Link } from 'react-router-dom';

export function TopBar({ right }) {
  return (
    <header className="topbar">
      <Link className="brand" to="/">DDNet Portal</Link>
      <nav className="top-actions">{right}</nav>
    </header>
  );
}

export function BackgroundOrbs() {
  return (
    <>
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
    </>
  );
}

export function Feedback({ feedback }) {
  if(!feedback) return null;
  return <section className={`result ${feedback.type}`}>{feedback.message}</section>;
}
