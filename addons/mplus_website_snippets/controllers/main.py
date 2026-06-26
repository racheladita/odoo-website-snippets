import json
import random
import urllib.error
import urllib.request
from datetime import datetime, timezone

from odoo import http
from odoo.http import request
from odoo.tools import html2plaintext


class WebsiteMarketSnippets(http.Controller):
    BITCOIN_RANGES = {
        1: ('1d', '1h'),
        7: ('7d', '1d'),
        30: ('1mo', '1d'),
        180: ('6mo', '1wk'),
        365: ('1y', '1wk'),
    }

    def _format_bitcoin_label(self, price_datetime, days):
        if days == 1:
            return price_datetime.strftime('%H:%M')
        if days >= 180:
            return price_datetime.strftime('%b %Y')
        return price_datetime.strftime('%b %d')

    @http.route(
        '/website_market_snippets/bitcoin_history',
        type='json',
        auth='public',
        website=True,
        methods=['POST'],
    )
    def get_bitcoin_history(self, days=1):
        try:
            selected_days = int(days)
        except (TypeError, ValueError):
            selected_days = 1
        selected_days = selected_days if selected_days in self.BITCOIN_RANGES else 1
        range_value, interval = self.BITCOIN_RANGES[selected_days]

        url = (
            'https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD'
            f'?range={range_value}&interval={interval}'
        )
        api_request = urllib.request.Request(
            url,
            headers={
                'Accept': 'application/json',
                'User-Agent': 'OdooWebsiteMarketSnippets/1.0',
            },
        )

        try:
            with urllib.request.urlopen(api_request, timeout=8) as response:
                payload = response.read().decode('utf-8')
        except (urllib.error.URLError, TimeoutError, OSError):
            return {
                'error': True,
                'message': 'Bitcoin price data is temporarily unavailable.',
                'prices': [],
            }

        try:
            data = json.loads(payload)
            result = data['chart']['result'][0]
            timestamps = result.get('timestamp') or []
            quote = result['indicators']['quote'][0]
            opens = quote.get('open') or []
            highs = quote.get('high') or []
            lows = quote.get('low') or []
            closes = quote.get('close') or []
        except (KeyError, IndexError, TypeError, ValueError):
            return {
                'error': True,
                'message': 'Bitcoin price data could not be read.',
                'prices': [],
            }

        prices = []
        for timestamp, open_price, high_price, low_price, close_price in zip(
            timestamps,
            opens,
            highs,
            lows,
            closes,
        ):
            if None in (open_price, high_price, low_price, close_price):
                continue
            price_datetime = datetime.fromtimestamp(timestamp, tz=timezone.utc)
            prices.append({
                'date': price_datetime.isoformat(),
                'label': self._format_bitcoin_label(
                    price_datetime,
                    selected_days,
                ),
                'open': round(float(open_price), 2),
                'high': round(float(high_price), 2),
                'low': round(float(low_price), 2),
                'close': round(float(close_price), 2),
            })

        if not prices:
            return {
                'error': False,
                'message': 'No Bitcoin price data was returned.',
                'prices': [],
            }

        return {
            'error': False,
            'currency': 'USD',
            'symbol': 'BTC-USD',
            'days': selected_days,
            'prices': prices,
        }

    @http.route(
        '/website_market_snippets/random_jobs',
        type='json',
        auth='public',
        website=True,
        methods=['POST'],
    )
    def get_random_jobs(self, department='all'):
        base_domain = [
            ('active', '=', True),
            ('website_published', '=', True),
        ]
        all_jobs = request.env['hr.job'].sudo().search(base_domain)
        departments = sorted(set(all_jobs.mapped('department_id.name')) - {False})
        domain = list(base_domain)

        if department and department != 'all':
            domain.append(('department_id.name', '=', department))

        jobs = request.env['hr.job'].sudo().search(domain)

        if not jobs:
            return {
                'departments': departments,
                'jobs': [],
            }

        selected_job_ids = random.sample(jobs.ids, min(4, len(jobs)))
        selected_jobs = request.env['hr.job'].sudo().browse(selected_job_ids)

        return {
            'departments': departments,
            'jobs': [
                {
                    'id': job.id,
                    'name': job.name,
                    'description': html2plaintext(job.description or '').strip(),
                    'department': (
                        job.department_id.name
                        if job.department_id
                        else ''
                    ),
                    'location': (
                        job.address_id.city
                        if job.address_id
                        else ''
                    ),
                    'url': job.website_url or '#',
                }
                for job in selected_jobs
            ],
        }