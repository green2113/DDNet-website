import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopBar } from '../components/Layout';
import { activatePaypalSubscription } from '../lib/api';

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export default function PlanSubscribePage() {
  const query = useQuery();
  const planId = String(query.get('plan') || '').trim();
  const planName = String(query.get('name') || 'Subscription').trim();
  const clientId = String(import.meta.env.VITE_PAYPAL_CLIENT_ID || '').trim();
  const buttonContainerRef = useRef(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if(!planId || !clientId || !buttonContainerRef.current) {
      return undefined;
    }

    let disposed = false;
    let paypalButtons = null;
    buttonContainerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => {
      if(disposed || !window.paypal || !buttonContainerRef.current) return;

      paypalButtons = window.paypal.Buttons({
        style: {
          shape: 'pill',
          color: 'gold',
          layout: 'vertical',
          label: 'subscribe',
        },
        createSubscription(data, actions) {
          return actions.subscription.create({
            plan_id: planId,
          });
        },
        async onApprove(data) {
          try {
            const result = await activatePaypalSubscription({
              subscriptionId: data.subscriptionID,
              planId,
            });
            setMessage(`구독 저장 완료 (${result?.subscription?.status || 'UNKNOWN'})`);
          } catch(err) {
            setMessage(`저장 실패: ${err?.message || 'Unknown error'}`);
          }
        },
        onError(err) {
          setMessage(`Payment error: ${err?.message || 'Unknown error'}`);
        },
      });
      paypalButtons.render(buttonContainerRef.current);
    };

    document.body.appendChild(script);
    return () => {
      disposed = true;
      if(paypalButtons && typeof paypalButtons.close === 'function') {
        paypalButtons.close();
      }
      if(script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [clientId, planId]);

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/billing/plans">Back to Plans</Link>} />

      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>PayPal Checkout</h1>
        <p className="lead">Plan: {planName}</p>
      </section>

      <article className="panel">
        {!planId ? <p className="result error">Missing plan id. Open this page with `?plan=P-...`.</p> : null}
        {!clientId ? <p className="result error">Missing `VITE_PAYPAL_CLIENT_ID` in frontend environment.</p> : null}
        <p className="muted mono-mini">Plan ID: {planId || '-'}</p>
        <div ref={buttonContainerRef} />
        {message ? <p className="result info">{message}</p> : null}
      </article>
    </main>
  );
}
