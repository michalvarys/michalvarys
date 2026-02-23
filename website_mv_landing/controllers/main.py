import logging

from odoo import _, http
from odoo.http import request

_logger = logging.getLogger(__name__)

INTEREST_MAP = {
    'novy-web': _('Nový web na míru'),
    'prevod-webu': _('Převod stávajícího webu'),
    'eshop': _('E-shop'),
    'sprava-udrzba': _('Správa a údržba webu'),
    'seo-marketing': _('SEO / Online marketing'),
    'jine': _('Jiné'),
}


class MVLandingController(http.Controller):

    @http.route('/mv-landing/contact', type='http', auth='public',
                methods=['POST'], website=True, csrf=True)
    def contact_form_submit(self, **kwargs):
        """Handle contact form submission and create CRM lead."""
        name = kwargs.get('name', '').strip()
        email = kwargs.get('email', '').strip()
        phone = kwargs.get('phone', '').strip()
        company = kwargs.get('company', '').strip()
        interest = kwargs.get('interest', '').strip()
        message = kwargs.get('message', '').strip()

        # Server-side validation
        errors = []
        if not name or len(name) < 2:
            errors.append(_('Jméno musí mít alespoň 2 znaky.'))
        if not email or '@' not in email:
            errors.append(_('Zadejte platný email.'))
        if not interest:
            errors.append(_('Vyberte, o co máte zájem.'))

        if errors:
            return request.make_json_response({
                'success': False,
                'message': ' '.join(errors),
            }, status=400)

        interest_label = INTEREST_MAP.get(interest, interest)

        try:
            # Build description from all available info
            desc_parts = []
            if company:
                desc_parts.append(_('Firma / Web: %s') % company)
            desc_parts.append(_('Zájem o: %s') % interest_label)
            if phone:
                desc_parts.append(_('Telefon: %s') % phone)
            if message:
                desc_parts.append(f'\n{message}')
            description = '\n'.join(desc_parts)

            # Find default sales team and salesperson
            CrmTeam = request.env['crm.team'].sudo()
            sales_team = CrmTeam.search([], limit=1)

            lead_vals = {
                'name': f'[Landing] {interest_label} - {name}',
                'contact_name': name,
                'email_from': email,
                'phone': phone or False,
                'partner_name': company or False,
                'description': description,
                'type': 'opportunity',
            }
            if sales_team:
                lead_vals['team_id'] = sales_team.id
                if sales_team.user_id:
                    lead_vals['user_id'] = sales_team.user_id.id

            # Add tag
            tag = request.env['crm.tag'].sudo().search(
                [('name', '=', 'Landing Page')], limit=1)
            if not tag:
                tag = request.env['crm.tag'].sudo().create(
                    {'name': 'Landing Page'})
            lead_vals['tag_ids'] = [(4, tag.id)]

            request.env['crm.lead'].sudo().create(lead_vals)
            _logger.info('MV Landing: CRM opportunity created for %s <%s>', name, email)

            return request.make_json_response({
                'success': True,
                'message': _('Děkujeme! Ozvu se vám do 24 hodin.'),
            })

        except Exception as e:
            _logger.exception('MV Landing contact form error: %s', e)
            return request.make_json_response({
                'success': False,
                'message': _('Omlouváme se, došlo k chybě. Zkuste to prosím znovu.'),
            }, status=500)
