#!/usr/bin/env python3
"""
Data quality audit script for Prospect Project Homie CSV files.
Checks for duplicates, missing fields, stale entries, and inconsistent formatting.
"""

import csv
import sys
from collections import Counter
from datetime import datetime

def audit_ppp_results(filepath):
    """Audit PPP-Prospect-Results.csv"""
    print("=" * 60)
    print("AUDIT: PPP-Prospect-Results.csv")
    print("=" * 60)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"\nTotal rows: {len(rows)}")
    print(f"Columns: {reader.fieldnames}")
    
    # Check for duplicates based on Business Name + Address
    seen = Counter()
    duplicates = []
    for i, row in enumerate(rows):
        key = (row['Business Name'].strip().lower(), row['Address'].strip().lower())
        seen[key] += 1
        if seen[key] > 1:
            duplicates.append((i, row['Business Name'], row['Address']))
    
    if duplicates:
        print(f"\n⚠️  DUPLICATES FOUND ({len(duplicates)}):")
        for idx, name, addr in duplicates:
            print(f"  Row {idx+2}: {name} @ {addr}")
    else:
        print("\n✅ No duplicates found (Business Name + Address)")
    
    # Check for missing fields
    print("\n📋 MISSING FIELD ANALYSIS:")
    for col in reader.fieldnames:
        missing = sum(1 for r in rows if not r[col].strip())
        pct = (missing / len(rows)) * 100
        status = "⚠️" if pct > 0 else "✅"
        print(f"  {status} {col}: {missing}/{len(rows)} missing ({pct:.1f}%)")
    
    # Check for inconsistent formatting
    print("\n🔍 FORMAT CONSISTENCY CHECKS:")
    
    # Phone format check
    phone_issues = []
    for i, row in enumerate(rows):
        phone = row['Phone'].strip()
        if phone and not (phone.startswith('(') or phone.startswith('248') or phone.startswith('734')):
            phone_issues.append((i, phone))
    if phone_issues:
        print(f"  ⚠️  Phone format issues ({len(phone_issues)}):")
        for idx, ph in phone_issues[:5]:
            print(f"    Row {idx+2}: {ph}")
    else:
        print("  ✅ Phone formats look consistent")
    
    # Email format check
    email_issues = []
    for i, row in enumerate(rows):
        email = row['Email'].strip()
        if email and '@' not in email:
            email_issues.append((i, email))
    if email_issues:
        print(f"  ⚠️  Email format issues ({len(email_issues)}):")
        for idx, em in email_issues[:5]:
            print(f"    Row {idx+2}: {em}")
    else:
        print("  ✅ Email formats look consistent")
    
    # Distance format check
    dist_issues = []
    for i, row in enumerate(rows):
        dist = row['Distance to Closing Branch (mi)'].strip()
        try:
            float(dist)
        except ValueError:
            if dist:
                dist_issues.append((i, dist))
    if dist_issues:
        print(f"  ⚠️  Distance format issues ({len(dist_issues)}):")
        for idx, d in dist_issues[:5]:
            print(f"    Row {idx+2}: {d}")
    else:
        print("  ✅ Distance values are valid numbers")
    
    # Loan amount format check
    loan_issues = []
    for i, row in enumerate(rows):
        for field in ['Total PPP Loan Amount', 'Total Forgiveness Amount']:
            val = row[field].strip()
            try:
                float(val)
            except ValueError:
                if val:
                    loan_issues.append((i, field, val))
    if loan_issues:
        print(f"  ⚠️  Loan amount format issues ({len(loan_issues)}):")
        for idx, field, val in loan_issues[:5]:
            print(f"    Row {idx+2} ({field}): {val}")
    else:
        print("  ✅ Loan amounts are valid numbers")
    
    # NAICS code check
    naics_issues = []
    for i, row in enumerate(rows):
        naics = row['NAICS Code'].strip()
        if naics and (not naics.isdigit() or len(naics) != 6):
            naics_issues.append((i, naics))
    if naics_issues:
        print(f"  ⚠️  NAICS code format issues ({len(naics_issues)}):")
        for idx, n in naics_issues[:5]:
            print(f"    Row {idx+2}: {n}")
    else:
        print("  ✅ NAICS codes are 6-digit numbers")
    
    # Zip code check
    zip_issues = []
    for i, row in enumerate(rows):
        zipc = row['Zip Code'].strip()
        if zipc and (not zipc.isdigit() or len(zipc) != 5):
            zip_issues.append((i, zipc))
    if zip_issues:
        print(f"  ⚠️  Zip code format issues ({len(zip_issues)}):")
        for idx, z in zip_issues[:5]:
            print(f"    Row {idx+2}: {z}")
    else:
        print("  ✅ Zip codes are 5-digit numbers")
    
    # Check for stale entries - businesses with "closed" or "relocated" notes
    print("\n📅 STALE/CAUTION ENTRIES:")
    caution_keywords = ['closed', 'relocated', 'caution', 'unverified', 'mismatch', 'wrong', 'expired', 'dead', 'parking', 'placeholder', 'not found', 'unconfirmed']
    stale = []
    for i, row in enumerate(rows):
        note = row.get('Contact Note', '').lower()
        for kw in caution_keywords:
            if kw in note:
                stale.append((i, row['Business Name'], kw, row['Contact Note'][:80]))
                break
    if stale:
        print(f"  ⚠️  Entries with caution/stale indicators ({len(stale)}):")
        for idx, name, kw, note in stale[:10]:
            print(f"    Row {idx+2}: {name} - [{kw}] {note}")
    else:
        print("  ✅ No obvious stale entries detected")
    
    return {
        'total_rows': len(rows),
        'duplicates': len(duplicates),
        'missing_fields': {col: sum(1 for r in rows if not r[col].strip()) for col in reader.fieldnames},
        'stale_count': len(stale)
    }


def audit_results_table(filepath):
    """Audit Results-Table.csv"""
    print("\n" + "=" * 60)
    print("AUDIT: Results-Table.csv")
    print("=" * 60)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"\nTotal rows: {len(rows)}")
    print(f"Columns: {reader.fieldnames}")
    
    # Check for duplicates based on Application Number
    seen = Counter()
    duplicates = []
    for i, row in enumerate(rows):
        key = row['Application Number'].strip()
        seen[key] += 1
        if seen[key] > 1:
            duplicates.append((i, row['Branch Name'], key))
    
    if duplicates:
        print(f"\n⚠️  DUPLICATES FOUND ({len(duplicates)}):")
        for idx, name, app in duplicates:
            print(f"  Row {idx+2}: {name} (App: {app})")
    else:
        print("\n✅ No duplicates found (Application Number)")
    
    # Check for missing fields
    print("\n📋 MISSING FIELD ANALYSIS:")
    for col in reader.fieldnames:
        missing = sum(1 for r in rows if not r[col].strip())
        pct = (missing / len(rows)) * 100
        status = "⚠️" if pct > 0 else "✅"
        print(f"  {status} {col}: {missing}/{len(rows)} missing ({pct:.1f}%)")
    
    # Date format check
    print("\n🔍 FORMAT CONSISTENCY CHECKS:")
    date_issues = []
    for i, row in enumerate(rows):
        for field in ['Action Date', 'Comment Period End Date']:
            val = row[field].strip()
            if val:
                try:
                    datetime.strptime(val, '%Y-%m-%d')
                except ValueError:
                    date_issues.append((i, field, val))
    if date_issues:
        print(f"  ⚠️  Date format issues ({len(date_issues)}):")
        for idx, field, val in date_issues[:5]:
            print(f"    Row {idx+2} ({field}): {val}")
    else:
        print("  ✅ Dates are in YYYY-MM-DD format")
    
    # URL format check
    url_issues = []
    for i, row in enumerate(rows):
        url = row['URL'].strip()
        if url and not url.startswith('https://apps.occ.gov'):
            url_issues.append((i, url))
    if url_issues:
        print(f"  ⚠️  URL format issues ({len(url_issues)}):")
        for idx, u in url_issues[:5]:
            print(f"    Row {idx+2}: {u}")
    else:
        print("  ✅ URLs are consistent OCC links")
    
    # State check
    states = Counter(r['State'].strip() for r in rows)
    print(f"\n📍 State distribution: {dict(states)}")
    
    # Action type check
    actions = Counter(r['Application Type'].strip() for r in rows)
    print(f"📋 Application types: {dict(actions)}")
    
    # Action check
    actions_taken = Counter(r['Action'].strip() for r in rows)
    print(f"✅ Actions: {dict(actions_taken)}")
    
    return {
        'total_rows': len(rows),
        'duplicates': len(duplicates),
        'missing_fields': {col: sum(1 for r in rows if not r[col].strip()) for col in reader.fieldnames},
        'state_distribution': dict(states)
    }


if __name__ == '__main__':
    ppp_results = audit_ppp_results('/root/prospectprojecthomie/PPP-Prospect-Results.csv')
    results_table = audit_results_table('/root/prospectprojecthomie/Results-Table.csv')
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"PPP-Prospect-Results: {ppp_results['total_rows']} rows, {ppp_results['duplicates']} duplicates, {ppp_results['stale_count']} stale entries")
    print(f"Results-Table: {results_table['total_rows']} rows, {results_table['duplicates']} duplicates")
    
    # Check missing fields summary
    print("\nFields with missing data:")
    for col, count in ppp_results['missing_fields'].items():
        if count > 0:
            print(f"  PPP-Prospect-Results.{col}: {count}")
    for col, count in results_table['missing_fields'].items():
        if count > 0:
            print(f"  Results-Table.{col}: {count}")