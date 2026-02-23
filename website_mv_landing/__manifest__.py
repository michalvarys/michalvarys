{
    'name': 'Michal Varys - Landing Page',
    'version': '18.0.1.0.0',
    'category': 'Website',
    'summary': 'Conversion landing page with CRM lead capture',
    'description': """
        Conversion-focused landing page for Michal Varys web development services.
        Form submissions are saved as CRM leads.
    """,
    'author': 'Michal Varys',
    'website': 'https://michalvarys.eu',
    'license': 'LGPL-3',
    'depends': [
        'website',
        'crm',
    ],
    'data': [
        'views/snippets/s_mv_hero.xml',
        'views/snippets/s_mv_trust_bar.xml',
        'views/snippets/s_mv_problem.xml',
        'views/snippets/s_mv_anchor.xml',
        'views/snippets/s_mv_offer.xml',
        'views/snippets/s_mv_irresistible.xml',
        'views/snippets/s_mv_testimonials.xml',
        'views/snippets/s_mv_process.xml',
        'views/snippets/s_mv_faq.xml',
        'views/snippets/s_mv_contact_form.xml',
        'views/snippets/s_mv_footer.xml',
        'views/snippets/s_mv_sticky_cta.xml',
        'views/snippets/snippets_registry.xml',
        'views/pages.xml',
        'data/website_menu_data.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'website_mv_landing/static/src/scss/landing.scss',
            'website_mv_landing/static/src/js/landing.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
