'use client';

import { useMemo, useState } from 'react';
import type { Prospect, SortConfig } from '@/data/types';

type Stats = {
  total: number;
  totalLoan: number;
  totalForgiven: number;
  withPhone: number;
  withEmail: number;
  avgDistance: number;
};

type Props = {
  prospects: Prospect[];
  zipCodes: string[];
  branches: string[];
  stats: Stats;
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const numberValue = (value: string) => Number.parseFloat(value || '0') || 0;

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function ProspectExplorer({ prospects, zipCodes, branches, stats }: Props) {
  const [search, setSearch] = useState('');
  const [zipCode, setZipCode] = useState('all');
  const [branch, setBranch] = useState('all');
  const [minLoan, setMinLoan] = useState('');
  const [maxDistance, setMaxDistance] = useState('2');
  const [contactableOnly, setContactableOnly] = useState(false);
  const [sort, setSort] = useState<SortConfig>({
    key: 'Distance to Closing Branch (mi)',
    direction: 'asc',
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const minimum = minLoan ? Number(minLoan) : 0;
    const maximumDistance = maxDistance ? Number(maxDistance) : Number.POSITIVE_INFINITY;

    return prospects
      .filter((prospect) => {
        const searchable = [
          prospect['Business Name'],
          prospect.Address,
          prospect.City,
          prospect['NAICS Code'],
          prospect['PPP Lender'],
          prospect['Nearest Closing Branch'],
          prospect.Phone,
          prospect.Email,
          prospect['Contact Note'],
        ]
          .join(' ')
          .toLowerCase();

        return (
          (!needle || searchable.includes(needle)) &&
          (zipCode === 'all' || prospect['Zip Code'] === zipCode) &&
          (branch === 'all' || prospect['Nearest Closing Branch'] === branch) &&
          numberValue(prospect['Total PPP Loan Amount']) >= minimum &&
          numberValue(prospect['Distance to Closing Branch (mi)']) <= maximumDistance &&
          (!contactableOnly || Boolean(prospect.Phone || prospect.Email))
        );
      })
      .sort((a, b) => {
        const numericKeys: Array<keyof Prospect> = [
          'Total PPP Loan Amount',
          'Total Forgiveness Amount',
          'Distance to Closing Branch (mi)',
        ];
        const result = numericKeys.includes(sort.key)
          ? numberValue(a[sort.key]) - numberValue(b[sort.key])
          : a[sort.key].localeCompare(b[sort.key]);
        return sort.direction === 'asc' ? result : -result;
      });
  }, [branch, contactableOnly, maxDistance, minLoan, prospects, search, sort, zipCode]);

  const filteredLoanTotal = filtered.reduce(
    (sum, prospect) => sum + numberValue(prospect['Total PPP Loan Amount']),
    0,
  );

  function updateSort(key: keyof Prospect) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function resetFilters() {
    setSearch('');
    setZipCode('all');
    setBranch('all');
    setMinLoan('');
    setMaxDistance('2');
    setContactableOnly(false);
  }

  function exportCsv() {
    const headers: Array<keyof Prospect> = [
      'Business Name',
      'Address',
      'City',
      'State',
      'Zip Code',
      'PPP Lender',
      'Total PPP Loan Amount',
      'Total Forgiveness Amount',
      'NAICS Code',
      'Nearest Closing Branch',
      'Nearest Branch Address',
      'Distance to Closing Branch (mi)',
      'Phone',
      'Email',
      'Contact Source',
      'Contact Note',
    ];
    const content = [
      headers.map(csvCell).join(','),
      ...filtered.map((prospect) => headers.map((header) => csvCell(prospect[header])).join(',')),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ppp-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const sortMark = (key: keyof Prospect) =>
    sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <>
      <section className="stats-grid" aria-label="Prospect summary">
        <article className="stat-card accent-card">
          <span>Matching prospects</span>
          <strong>{stats.total}</strong>
          <small>Across {zipCodes.length} target ZIP codes</small>
        </article>
        <article className="stat-card">
          <span>PPP loan volume</span>
          <strong>{money.format(stats.totalLoan)}</strong>
          <small>{money.format(stats.totalForgiven)} forgiven</small>
        </article>
        <article className="stat-card">
          <span>Contact coverage</span>
          <strong>{stats.withPhone + stats.withEmail}</strong>
          <small>{stats.withPhone} phones · {stats.withEmail} emails</small>
        </article>
        <article className="stat-card">
          <span>Average distance</span>
          <strong>{stats.avgDistance.toFixed(2)} mi</strong>
          <small>From the nearest closing branch</small>
        </article>
      </section>

      <section className="workspace-card">
        <div className="filters-heading">
          <div>
            <p className="eyebrow">Search & filter</p>
            <h2>Build an outreach list</h2>
          </div>
          <div className="filter-actions">
            <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
            <button className="button primary" type="button" onClick={exportCsv} disabled={!filtered.length}>
              Export {filtered.length} rows
            </button>
          </div>
        </div>

        <div className="filters-grid">
          <label className="field search-field">
            <span>Business, address, NAICS, or note</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try dental, 621210, or Farmington…"
            />
          </label>
          <label className="field">
            <span>ZIP code</span>
            <select value={zipCode} onChange={(event) => setZipCode(event.target.value)}>
              <option value="all">All ZIP codes</option>
              {zipCodes.map((zip) => <option key={zip} value={zip}>{zip}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Closing branch</span>
            <select value={branch} onChange={(event) => setBranch(event.target.value)}>
              <option value="all">All branches</option>
              {branches.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Minimum loan</span>
            <select value={minLoan} onChange={(event) => setMinLoan(event.target.value)}>
              <option value="">No minimum</option>
              <option value="100000">$100,000</option>
              <option value="250000">$250,000</option>
              <option value="500000">$500,000</option>
              <option value="1000000">$1,000,000</option>
            </select>
          </label>
          <label className="field">
            <span>Maximum distance</span>
            <select value={maxDistance} onChange={(event) => setMaxDistance(event.target.value)}>
              <option value="0.5">0.5 miles</option>
              <option value="1">1 mile</option>
              <option value="1.5">1.5 miles</option>
              <option value="2">2 miles</option>
              <option value="">Any distance</option>
            </select>
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={contactableOnly}
              onChange={(event) => setContactableOnly(event.target.checked)}
            />
            <span>Has phone or email</span>
          </label>
        </div>
      </section>

      <section className="results-card">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Results</p>
            <h2>{filtered.length} businesses</h2>
          </div>
          <p>{money.format(filteredLoanTotal)} in filtered PPP loans</p>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><button type="button" onClick={() => updateSort('Business Name')}>Business{sortMark('Business Name')}</button></th>
                <th><button type="button" onClick={() => updateSort('Total PPP Loan Amount')}>Loan{sortMark('Total PPP Loan Amount')}</button></th>
                <th><button type="button" onClick={() => updateSort('Distance to Closing Branch (mi)')}>Distance{sortMark('Distance to Closing Branch (mi)')}</button></th>
                <th>Contact</th>
                <th>Nearest closing branch</th>
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prospect) => {
                const id = `${prospect['Business Name']}-${prospect.Address}`;
                const isOpen = expanded === id;
                return (
                  <tr key={id} className={isOpen ? 'expanded-row' : ''}>
                    <td data-label="Business">
                      <strong>{prospect['Business Name']}</strong>
                      <span>{prospect.Address}, {prospect.City}, {prospect.State} {prospect['Zip Code']}</span>
                      <small>NAICS {prospect['NAICS Code']}</small>
                    </td>
                    <td data-label="Loan">
                      <strong>{money.format(numberValue(prospect['Total PPP Loan Amount']))}</strong>
                      <span>{money.format(numberValue(prospect['Total Forgiveness Amount']))} forgiven</span>
                    </td>
                    <td data-label="Distance">
                      <span className="distance-pill">{numberValue(prospect['Distance to Closing Branch (mi)']).toFixed(2)} mi</span>
                    </td>
                    <td data-label="Contact">
                      {prospect.Phone ? <a href={`tel:${prospect.Phone}`}>{prospect.Phone}</a> : null}
                      {prospect.Email ? <a href={`mailto:${prospect.Email}`}>{prospect.Email}</a> : null}
                      {!prospect.Phone && !prospect.Email ? <span className="muted">No public contact</span> : null}
                    </td>
                    <td data-label="Branch">
                      <strong>{prospect['Nearest Closing Branch']}</strong>
                      <span>{prospect['Nearest Branch Address']}</span>
                    </td>
                    <td data-label="Details">
                      <button
                        type="button"
                        className="details-button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : id)}
                      >
                        {isOpen ? 'Hide' : 'Details'}
                      </button>
                      {isOpen ? (
                        <div className="mobile-detail">
                          <p><b>Source:</b> {prospect['Contact Source'] || 'Not recorded'}</p>
                          <p><b>Notes:</b> {prospect['Contact Note'] || 'No notes'}</p>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filtered.length ? (
          <div className="empty-state">
            <h3>No businesses match these filters</h3>
            <p>Try increasing the distance or clearing one of the filters.</p>
            <button type="button" className="button secondary" onClick={resetFilters}>Clear filters</button>
          </div>
        ) : null}
      </section>
    </>
  );
}
