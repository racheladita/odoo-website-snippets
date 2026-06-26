{
    'name': 'Website Market Snippets',
    'version': '18.0.1.0.0',
    'category': 'Website',
    'summary': 'BTC-USD candlestick chart and random recruitment job snippets',
    'description': """
        Adds two Odoo 18 Website Builder snippets:
        a Dynamic Content snippet that displays BTC-USD price history as an
        interactive candlestick chart, and a Structure snippet that displays
        four random published jobs from the Recruitment module on each page load.
    """,
    'author': 'Adita Putri Puspaningrum',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'website',
        'hr_recruitment',
        'website_hr_recruitment',
    ],
    'data': [
        'data/departments.xml',
        'data/sample_jobs.xml',
        'views/snippets.xml',
        'views/preview_page.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'mplus_website_snippets/static/src/js/bitcoin_chart.js',
            'mplus_website_snippets/static/src/js/random_jobs.js',
            'mplus_website_snippets/static/src/scss/snippets.scss',
        ],
    },
    'installable': True,
    'application': False,
}