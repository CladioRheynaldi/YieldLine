"use client";

import { useMemo, useState } from "react";

import { Metric } from "./metric";

type ScenarioName = "Healthy" | "Oracle degraded" | "Oracle hard stale" | "NAV shock";

const scenarios: Record<ScenarioName, { nav: number; age: number; valid: boolean }> = {
  Healthy: { nav: 1.05, age: 4, valid: true },
  "Oracle degraded": { nav: 1.05, age: 48, valid: true },
  "Oracle hard stale": { nav: 1.05, age: 73, valid: true },
  "NAV shock": { nav: 0.6, age: 1, valid: true },
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function freshnessFor(age: number, valid: boolean) {
  if (!valid || age >= 72) return 0;
  if (age <= 24) return 1;
  return (72 - age) / (72 - 24);
}

export function RiskSimulator() {
  const [nav, setNav] = useState(1.05);
  const [age, setAge] = useState(4);
  const [valid, setValid] = useState(true);

  const result = useMemo(() => {
    const freshness = freshnessFor(age, valid);
    const raw = 100_000 * nav;
    const effective = raw * 0.9 * 0.95 * freshness;
    const borrowCapacity = effective * 0.75;
    const liquidationCapacity = effective * 0.82;
    const debt = 50_000;
    const healthFactor = liquidationCapacity / debt;

    return {
      freshness,
      raw,
      effective,
      borrowCapacity,
      healthFactor,
      canBorrow: valid && freshness > 0,
      liquidatable: valid && freshness > 0 && debt > liquidationCapacity,
    };
  }, [age, nav, valid]);

  const applyScenario = (name: ScenarioName) => {
    const scenario = scenarios[name];
    setNav(scenario.nav);
    setAge(scenario.age);
    setValid(scenario.valid);
  };

  const tone = result.liquidatable ? "danger" : result.healthFactor < 1.2 ? "warning" : "healthy";

  return (
    <>
      <div className="scenario-row" aria-label="Scenario presets">
        {(Object.keys(scenarios) as ScenarioName[]).map((name) => (
          <button className="button button--quiet" key={name} onClick={() => applyScenario(name)} type="button">
            {name}
          </button>
        ))}
      </div>

      <section className="simulator-grid">
        <form className="simulator-controls" onSubmit={(event) => event.preventDefault()}>
          <h2>Mock controls</h2>
          <label htmlFor="nav-value">Mock NAV</label>
          <div className="amount-input">
            <input
              id="nav-value"
              min="0.1"
              onChange={(event) => setNav(Number(event.target.value))}
              step="0.01"
              type="number"
              value={nav}
            />
            <span>USD</span>
          </div>

          <label htmlFor="oracle-age">Oracle age · {age} hours</label>
          <input
            className="range-input"
            id="oracle-age"
            max="96"
            min="0"
            onChange={(event) => setAge(Number(event.target.value))}
            type="range"
            value={age}
          />

          <label className="checkbox-row">
            <input checked={valid} onChange={(event) => setValid(event.target.checked)} type="checkbox" />
            Oracle source reports valid
          </label>
          <p className="field-message">
            These controls model admin-only workshop actions. They are not a production oracle.
          </p>
        </form>

        <div className="simulator-result">
          <div className="simulator-result__head">
            <div><span>Computed state</span><strong>100,000 mTBILL · $50,000 debt</strong></div>
            <span className="state-badge" data-tone={tone}>
              {result.liquidatable ? "Liquidatable" : result.canBorrow ? "Borrow enabled" : "Borrow disabled"}
            </span>
          </div>
          <div className="metrics-strip metrics-strip--two">
            <Metric label="Freshness factor" value={`${(result.freshness * 100).toFixed(2)}%`} tone={tone} />
            <Metric label="Health factor" value={result.healthFactor.toFixed(4)} tone={tone} />
            <Metric label="Raw value" value={money.format(result.raw)} />
            <Metric label="Effective value" value={money.format(result.effective)} />
            <Metric label="Borrow capacity" value={money.format(result.borrowCapacity)} />
            <Metric label="Oracle age" value={`${age} hours`} tone={age >= 72 ? "danger" : age > 24 ? "warning" : "healthy"} />
          </div>
          <p className="policy-message" data-tone={tone} aria-live="polite">
            {result.liquidatable
              ? "The fresh NAV shock puts health below 1.0000. Liquidation may enter pending settlement."
              : !result.canBorrow
                ? "Hard-stale or invalid data blocks new borrowing. It does not liquidate the position by itself."
                : age > 24
                  ? "Borrowing power is degrading linearly as the NAV ages."
                  : "The oracle is fresh and the documented position remains healthy."}
          </p>
        </div>
      </section>
    </>
  );
}
