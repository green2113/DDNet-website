import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';

function getPortalRoot() {
  if(typeof document === 'undefined') {
    return null;
  }
  return document.getElementById('overlay-root') || document.body;
}

export default function Tooltip({ label, children }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [portalPos, setPortalPos] = useState(null);
  const hideTimerRef = useRef(null);

  const updatePortalPos = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if(!rect) {
      return;
    }
    setPortalPos({
      left: rect.left + rect.width / 2,
      top: rect.top,
    });
  };

  useEffect(() => {
    if(hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if(open) {
      updatePortalPos();
      setRendered(true);
      requestAnimationFrame(() => setVisible(true));
      window.addEventListener('resize', updatePortalPos);
      window.addEventListener('scroll', updatePortalPos, true);
      return () => {
        window.removeEventListener('resize', updatePortalPos);
        window.removeEventListener('scroll', updatePortalPos, true);
      };
    }

    setVisible(false);
    hideTimerRef.current = setTimeout(() => {
      setRendered(false);
      hideTimerRef.current = null;
    }, 150);

    return () => {
      if(hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    const closeTooltipImmediate = () => {
      if(hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setOpen(false);
      setVisible(false);
      setRendered(false);
    };

    const handleKey = (event) => {
      if(event.key === 'Escape') {
        closeTooltipImmediate();
      }
    };

    const handleVisibility = () => {
      if(document.visibilityState !== 'visible') {
        closeTooltipImmediate();
      }
    };

    window.addEventListener('blur', closeTooltipImmediate);
    window.addEventListener('keydown', handleKey);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if(hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      window.removeEventListener('blur', closeTooltipImmediate);
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const tooltip = rendered && portalPos ? (
    <span
      role="tooltip"
      className={`tooltip-bubble tooltip-floating ${visible ? 'is-visible' : ''}`}
      style={{
        left: portalPos.left,
        top: portalPos.top,
      }}
    >
      <span className="tooltip-text">{label}</span>
      <svg className="tooltip-arrow" width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
        <path d="M1 9 L8 1 L15 9 Z" fill="rgba(7, 12, 30, 0.98)" />
        <path
          d="M1 9 L6.6 2.6 Q8 1 9.4 2.6 L15 9"
          fill="none"
          stroke="rgba(145, 173, 226, 0.24)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  ) : null;

  const portalRoot = getPortalRoot();

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrap"
      onMouseEnter={() => {
        updatePortalPos();
        requestAnimationFrame(() => setOpen(true));
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {}}
      onBlur={() => {}}
    >
      {children}
      {portalRoot && tooltip ? createPortal(tooltip, portalRoot) : tooltip}
    </span>
  );
}
