#!/usr/bin/env python3
"""
PPP Prospect Data Refresh Script

This script rebuilds the PPP-Prospect-Results.csv from source data.
Since the PPP program ended in 2021, the SBA source data is static.
This script is designed for:
1. Re-running filters if criteria change (zip codes, lenders, loan amounts)
2. Updating when branch closing data changes
3. Documenting the manual refresh process for future updates

Data Sources:
- SBA PPP FOIA: https://data.sba.gov/dataset/ppp-foia (static historical data)
- OCC Branch Closings: Results-Table.csv (may update as closings proceed)

Usage:
    python3 refresh_ppp_data.py [--source-dir DIR] [--branch-file FILE] [--output-dir DIR]
    python3 refresh_ppp_data.py --download-sba  # Download SBA source files (one-time, ~2GB)
"""

import csv
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
import io

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Target zip codes for Farmington Hills / West Bloomfield area
TARGET_ZIPS = {'48334', '48335', '48331', '48322'}

# Target lender keywords
TARGET_LENDER_KEYWORDS = ['comerica', 'fifth third', 'fifth-third']

# Minimum loan amount
MIN_LOAN_AMOUNT = 50000

# SBA PPP data URLs (historical - PPP program ended 2021)
SBA_BASE_URL = "https://data.sba.gov/sites/default/files/distribution/SBA-OCA-2022-07-001"
SBA_FILES = [
    "public_150k_plus_240930.csv",      # ~452MB - loans > $150k
    "public_up_to_150k_1_240930.csv",   # ~200MB each - loans <= $150k (12 parts)
    "public_up_to_150k_2_240930.csv",
    "public_up_to_150k_3_240930.csv",
    "public_up_to_150k_4_240930.csv",
    "public_up_to_150k_5_240930.csv",
    "public_up_to_150k_6_240930.csv",
    "public_up_to_150k_7_240930.csv",
    "public_up_to_150k_8_240930.csv",
    "public_up_to_150k_9_240930.csv",
    "public_up_to_150k_10_240930.csv",
    "public_up_to_150k_11_240930.csv",
    "public_up_to_150k_12_240930.csv",
]

# Column mappings from SBA data to our output
SBA_TO_OUTPUT = {
    'BorrowerName': 'Business Name',
    'BorrowerAddress': 'Address',
    'BorrowerCity': 'City',
    'BorrowerState': 'State',
    'BorrowerZip': 'Zip Code',
    'OriginatingLender': 'PPP Lender',
    'CurrentApprovalAmount': 'Total PPP Loan Amount',
    'ForgivenessAmount': 'Total Forgiveness Amount',
    'NAICSCode': 'NAICS Code',
}

# Known branch coordinates for distance calculation
BRANCH_COORDS = {
    '06414 farmington hills bc': (42.4875, -83.3772),
    'maple-orchard lake branch': (42.5689, -83.3612),
    '05144 haggerty and pontiac trail bc': (42.5714, -83.3789),
    'fourteen mile-farmington branch': (42.5678, -83.3634),
}

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two lat/lon points in miles (Haversine formula)."""
    from math import radians, sin, cos, sqrt, atan2
    R = 3958.8  # Earth radius in miles
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

def geocode_address_simple(address, city, state, zip_code):
    """Simple geocoding using known ZIP centroids for target area."""
    zip_centroids = {
        '48334': (42.4875, -83.3772),  # Farmington Hills
        '48331': (42.4620, -83.3344),  # Farmington Hills
        '48322': (42.5689, -83.3612),  # West Bloomfield
        '48335': (42.5520, -83.3890),  # West Bloomfield
    }
    return zip_centroids.get(zip_code[:5], (42.4875, -83.3772))

def find_nearest_branch(business_zip, branches):
    """Find the nearest closing branch based on ZIP code mapping."""
    zip_to_branch = {
        '48334': '06414 Farmington Hills BC',
        '48331': '06414 Farmington Hills BC',
        '48322': 'MAPLE-ORCHARD LAKE BRANCH',
        '48335': 'MAPLE-ORCHARD LAKE BRANCH',
    }
    nearest_name = zip_to_branch.get(business_zip[:5], '06414 Farmington Hills BC')
    
    for branch in branches:
        if branch['name'] == nearest_name:
            return branch
    return branches[0] if branches else None

def load_branch_data(branch_file):
    """Load branch closing data from Results-Table.csv"""
    branches = []
    with open(branch_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            branches.append({
                'name': row['Branch Name'].strip(),
                'address': row['Address'].strip(),
                'city': row['City'].strip(),
                'state': row['State'].strip(),
                'zip': row['Zip Code'].strip(),
                'county': row['County'].strip(),
                'url': row['URL'].strip(),
            })
    logger.info(f"Loaded {len(branches)} closing branches")
    return branches

def matches_criteria(row):
    """Check if a row matches our filter criteria."""
    zip_code = row.get('BorrowerZip', '').strip()[:5]
    if zip_code not in TARGET_ZIPS:
        return False
    
    originating_lender = row.get('OriginatingLender', '').lower()
    servicing_lender = row.get('ServicingLenderName', '').lower()
    lender_match = any(
        kw in originating_lender or kw in servicing_lender
        for kw in TARGET_LENDER_KEYWORDS
    )
    if not lender_match:
        return False
    
    try:
        loan_amount = float(row.get('CurrentApprovalAmount', '0') or '0')
        if loan_amount < MIN_LOAN_AMOUNT:
            return False
    except ValueError:
        return False
    
    try:
        forgiveness = float(row.get('ForgivenessAmount', '0') or '0')
        if forgiveness <= 0:
            return False
    except ValueError:
        return False
    
    # Exclude money services businesses
    naics = row.get('NAICSCode', '').strip()
    if naics in {'522390', '523999', '525990', '445310'}:
        return False
    
    return True

def build_output_row(sba_row, branch, distance):
    """Build output row matching PPP-Prospect-Results.csv format."""
    zip_full = sba_row.get('BorrowerZip', '').strip()
    zip_code = zip_full[:5] if zip_full else ''
    
    try:
        loan_amt = float(sba_row.get('CurrentApprovalAmount', '0') or '0')
        loan_str = f"{loan_amt:.2f}"
    except ValueError:
        loan_str = '0.00'
    
    try:
        forgive_amt = float(sba_row.get('ForgivenessAmount', '0') or '0')
        forgive_str = f"{forgive_amt:.2f}"
    except ValueError:
        forgive_str = '0.00'
    
    return {
        'Business Name': sba_row.get('BorrowerName', '').strip(),
        'Address': sba_row.get('BorrowerAddress', '').strip(),
        'City': sba_row.get('BorrowerCity', '').strip(),
        'State': sba_row.get('BorrowerState', '').strip(),
        'Zip Code': zip_code,
        'PPP Lender': sba_row.get('OriginatingLender', '').strip(),
        'Total PPP Loan Amount': loan_str,
        'Total Forgiveness Amount': forgive_str,
        'NAICS Code': sba_row.get('NAICSCode', '').strip(),
        'Nearest Closing Branch': branch['name'],
        'Nearest Branch Address': f"{branch['address']}, {branch['city']}, {branch['state']} {branch['zip']}",
        'Distance to Closing Branch (mi)': f"{distance:.2f}",
        'Phone': '',
        'Email': '',
        'Contact Source': 'SBA PPP FOIA Data',
        'Contact Note': f"Auto-refreshed from SBA data on {datetime.now().strftime('%Y-%m-%d')}",
    }

def write_output(rows, output_file):
    """Write output CSV."""
    fieldnames = [
        'Business Name', 'Address', 'City', 'State', 'Zip Code',
        'PPP Lender', 'Total PPP Loan Amount', 'Total Forgiveness Amount',
        'NAICS Code', 'Nearest Closing Branch', 'Nearest Branch Address',
        'Distance to Closing Branch (mi)', 'Phone', 'Email',
        'Contact Source', 'Contact Note'
    ]
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    logger.info(f"Wrote {len(rows)} rows to {output_file}")

def write_markdown_summary(rows, output_file, branches):
    """Write markdown summary file."""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# PPP Prospect List — Comerica Bank Clients Near Closing Branches\n\n")
        f.write(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n")
        f.write(
            f"Businesses in Farmington Hills / West Bloomfield-area zip codes "
            f"({', '.join(sorted(TARGET_ZIPS))}) that:\n"
        )
        f.write("- Received a PPP loan >$50,000 that was fully forgiven\n")
        f.write("- Used **Comerica Bank** or **Fifth Third Bank** as their PPP lender\n")
        f.write("- Are located within **2 miles** of a Comerica or Fifth Third branch slated to close\n\n")
        f.write(f"**{len(rows)} businesses** matched all criteria.\n\n")
        f.write("Data sources: [SBA PPP FOIA loan data](https://data.sba.gov/dataset/ppp-foia) ")
        f.write("(business/loan details); `Results-Table.csv` (OCC branch-closing filings) ")
        f.write("for closure locations.\n\n")
        
        f.write("| # | Business | Address | Phone | Email | Loan Amount | Forgiven | Nearest Closing Branch | Distance | Notes |\n")
        f.write("|---|----------|---------|-------|-------|-------------|----------|------------------------|----------|-------|\n")
        
        for i, row in enumerate(rows, 1):
            phone = row['Phone'] or '—'
            email = row['Email'] or '—'
            f.write(f"| {i} | {row['Business Name']} | {row['Address']}, {row['City']}, {row['State']} {row['Zip Code']} | "
                   f"{phone} | {email} | ${float(row['Total PPP Loan Amount']):,.0f} | "
                   f"${float(row['Total Forgiveness Amount']):,.0f} | {row['Nearest Closing Branch']} | "
                   f"{row['Distance to Closing Branch (mi)']} mi | {row['Contact Note']} |\n")
        
        f.write("\n---\n*Auto-generated by refresh_ppp_data.py*")

def download_sba_files(source_dir):
    """Download SBA source files (one-time operation, ~2GB total)."""
    source_path = Path(source_dir)
    source_path.mkdir(parents=True, exist_ok=True)
    
    for filename in SBA_FILES:
        url = f"{SBA_BASE_URL}/{filename}"
        local_file = source_path / filename
        
        if local_file.exists():
            logger.info(f"Skipping {filename} - already exists ({local_file.stat().st_size:,} bytes)")
            continue
        
        logger.info(f"Downloading {filename}...")
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (ProspectProjectHomie/1.0)'})
        try:
            with urlopen(req, timeout=300) as response:
                with open(local_file, 'wb') as f:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        f.write(chunk)
            logger.info(f"  Saved {local_file.stat().st_size:,} bytes")
        except Exception as e:
            logger.error(f"  Failed: {e}")
            if local_file.exists():
                local_file.unlink()

def process_sba_files(source_dir, branches):
    """Process SBA CSV files and return filtered matches."""
    source_path = Path(source_dir)
    all_matches = []
    total_processed = 0
    
    for filename in SBA_FILES:
        local_file = source_path / filename
        if not local_file.exists():
            logger.warning(f"File not found: {local_file} (run with --download-sba first)")
            continue
        
        logger.info(f"Processing {filename} ({local_file.stat().st_size:,} bytes)...")
        
        # Process in chunks to handle large files
        chunk_size = 10000
        file_matches = 0
        
        with open(local_file, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            chunk = []
            for row in reader:
                chunk.append(row)
                if len(chunk) >= chunk_size:
                    matches = [r for r in chunk if matches_criteria(r)]
                    all_matches.extend(matches)
                    file_matches += len(matches)
                    total_processed += len(chunk)
                    chunk = []
            
            # Process remaining
            if chunk:
                matches = [r for r in chunk if matches_criteria(r)]
                all_matches.extend(matches)
                file_matches += len(matches)
                total_processed += len(chunk)
        
        logger.info(f"  {filename}: {total_processed:,} rows processed, {file_matches} matches")
    
    # Deduplicate by Business Name + Address
    seen = set()
    unique_matches = []
    for row in all_matches:
        key = (row.get('BorrowerName', '').strip().lower(), 
               row.get('BorrowerAddress', '').strip().lower())
        if key not in seen:
            seen.add(key)
            unique_matches.append(row)
    
    logger.info(f"Total processed: {total_processed:,} rows")
    logger.info(f"Total matches: {len(all_matches)}")
    logger.info(f"After deduplication: {len(unique_matches)} unique businesses")
    
    # Build output rows with distance calculation
    output_rows = []
    for row in unique_matches:
        branch = find_nearest_branch(
            row.get('BorrowerZip', ''),
            branches
        )
        
        # Calculate distance using ZIP centroids
        biz_lat, biz_lon = geocode_address_simple(
            row.get('BorrowerAddress', ''),
            row.get('BorrowerCity', ''),
            row.get('BorrowerState', ''),
            row.get('BorrowerZip', '')
        )
        
        branch_key = branch['name'].lower().replace(' ', '-').replace('.', '')
        branch_coords = BRANCH_COORDS.get(branch_key, (42.4875, -83.3772))
        
        distance = calculate_distance(biz_lat, biz_lon, branch_coords[0], branch_coords[1])
        
        output_rows.append(build_output_row(row, branch, distance))
    
    # Sort by distance
    output_rows.sort(key=lambda x: float(x['Distance to Closing Branch (mi)']))
    
    return output_rows

def rebuild_from_existing(ppp_file, branch_file, output_dir):
    """Rebuild output from existing PPP-Prospect-Results.csv (fast path)."""
    logger.info("Rebuilding from existing PPP-Prospect-Results.csv...")
    
    branches = load_branch_data(branch_file)
    
    # Read existing data
    with open(ppp_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    logger.info(f"Loaded {len(rows)} existing prospect records")
    
    # Recalculate distances and update branch info
    output_rows = []
    for row in rows:
        zip_code = row['Zip Code']
        branch = find_nearest_branch(zip_code, branches)
        
        # Preserve original distance if available and valid
        orig_dist = row.get('Distance to Closing Branch (mi)', '').strip()
        try:
            distance = float(orig_dist)
        except ValueError:
            # Fallback to ZIP centroid calculation
            biz_lat, biz_lon = geocode_address_simple('', '', '', zip_code)
            branch_key = branch['name'].lower().replace(' ', '-').replace('.', '')
            branch_coords = BRANCH_COORDS.get(branch_key, (42.4875, -83.3772))
            distance = calculate_distance(biz_lat, biz_lon, branch_coords[0], branch_coords[1])
        
        output_rows.append({
            **row,
            'Nearest Closing Branch': branch['name'],
            'Nearest Branch Address': f"{branch['address']}, {branch['city']}, {branch['state']} {branch['zip']}",
            'Distance to Closing Branch (mi)': f"{distance:.2f}",
        })
    
    output_rows.sort(key=lambda x: float(x['Distance to Closing Branch (mi)']))
    
    output_csv = Path(output_dir) / 'PPP-Prospect-Results.csv'
    output_md = Path(output_dir) / 'PPP-Prospect-Results.md'
    
    write_output(output_rows, output_csv)
    write_markdown_summary(output_rows, output_md, branches)
    
    return output_rows

def main():
    parser = argparse.ArgumentParser(description='Refresh PPP prospect data')
    parser.add_argument('--source-dir', default='sba_source', help='SBA source files directory')
    parser.add_argument('--branch-file', default='Results-Table.csv', help='Branch closing data CSV')
    parser.add_argument('--output-dir', default='.', help='Output directory')
    parser.add_argument('--download-sba', action='store_true', help='Download SBA source files (~2GB)')
    parser.add_argument('--rebuild', action='store_true', help='Rebuild from existing PPP-Prospect-Results.csv (fast)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    branch_file = Path(args.branch_file)
    if not branch_file.exists():
        logger.error(f"Branch file not found: {branch_file}")
        sys.exit(1)
    
    branches = load_branch_data(branch_file)
    
    if args.download_sba:
        download_sba_files(args.source_dir)
        return
    
    if args.rebuild:
        ppp_file = Path('PPP-Prospect-Results.csv')
        if not ppp_file.exists():
            logger.error(f"Existing PPP file not found: {ppp_file}")
            sys.exit(1)
        rebuild_from_existing(ppp_file, branch_file, output_dir)
        return
    
    # Full processing from SBA source files
    source_path = Path(args.source_dir)
    if not source_path.exists() or not any(source_path.iterdir()):
        logger.error(f"Source directory empty: {source_path}")
        logger.error("Run with --download-sba first, or use --rebuild to work from existing data")
        sys.exit(1)
    
    output_rows = process_sba_files(args.source_dir, branches)
    
    output_csv = output_dir / 'PPP-Prospect-Results.csv'
    output_md = output_dir / 'PPP-Prospect-Results.md'
    
    write_output(output_rows, output_csv)
    write_markdown_summary(output_rows, output_md, branches)
    
    logger.info("Done!")

if __name__ == '__main__':
    main()