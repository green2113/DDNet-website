import { Link } from 'react-router-dom';
import { TopBar } from '../components/Layout';

export default function PlanStorePage() {
  const plusPlanId = String(import.meta.env.VITE_PAYPAL_PLAN_ID_PLUS || 'P-14V362713R263544HNGO3P5I').trim();
  const plusPaymentUrl = String(import.meta.env.VITE_PAYPAL_NCP_PLUS_URL || 'https://www.paypal.com/ncp/payment/VAKVWHUDLD2BS').trim();
  const plans = [
    {
      key: 'plus',
      name: 'Ravion Plus',
      price: '$4.99 / month',
      planId: plusPlanId,
      paymentUrl: plusPaymentUrl,
      features: ['Basic supporter badge', 'Priority queue', 'Monthly perks'],
    },
  ];

  return (
    <main className="shell">
      <TopBar right={<Link className="btn ghost" to="/dashboard">Dashboard</Link>} />

      <section className="hero">
        <p className="eyebrow">Billing</p>
        <h1>Subscription Plans</h1>
        <p className="lead">Choose a plan and continue to the secure PayPal subscription page.</p>
        <p className="muted">Automatic activation works when the PayPal payer email matches your account email.</p>
      </section>

      <section className="plan-grid">
        {plans.map((plan) => (
          <article className="panel plan-card" key={plan.key}>
            <h3>{plan.name}</h3>
            <p className="plan-price">{plan.price}</p>
            <ul className="plan-features">
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            {plan.paymentUrl ? (
              <a className="btn block" href={plan.paymentUrl} target="_blank" rel="noreferrer">
                Continue with PayPal
              </a>
            ) : plan.planId ? (
              <Link className="btn block" to={`/billing/subscribe?plan=${encodeURIComponent(plan.planId)}&name=${encodeURIComponent(plan.name)}`}>
                Continue with PayPal
              </Link>
            ) : (
              <button className="btn block ghost" type="button" disabled>
                Plan ID required
              </button>
            )}
            {plan.paymentUrl ? (
              <p className="muted mono-mini">Checkout URL: configured</p>
            ) : plan.planId ? (
              <p className="muted mono-mini">Plan ID: {plan.planId}</p>
            ) : (
              <p className="muted mono-mini">Set `VITE_PAYPAL_PLAN_ID_PLUS`.</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
