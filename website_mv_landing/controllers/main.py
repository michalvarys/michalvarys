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
        crm_note = kwargs.get('crm_note', '').strip()

        # UTM params
        utm_source = kwargs.get('utm_source', '').strip()
        utm_medium = kwargs.get('utm_medium', '').strip()
        utm_campaign = kwargs.get('utm_campaign', '').strip()
        utm_term = kwargs.get('utm_term', '').strip()
        utm_content = kwargs.get('utm_content', '').strip()

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
            if crm_note:
                desc_parts.append(crm_note)
                desc_parts.append('')  # blank line separator
            if company:
                desc_parts.append(_('Firma / Web: %s') % company)
            desc_parts.append(_('Zájem o: %s') % interest_label)
            if phone:
                desc_parts.append(_('Telefon: %s') % phone)
            if message:
                desc_parts.append(f'\n{message}')

            # Append UTM info to description for easy visibility
            utm_parts = []
            if utm_source:
                utm_parts.append(f'source={utm_source}')
            if utm_medium:
                utm_parts.append(f'medium={utm_medium}')
            if utm_campaign:
                utm_parts.append(f'campaign={utm_campaign}')
            if utm_term:
                utm_parts.append(f'term={utm_term}')
            if utm_content:
                utm_parts.append(f'content={utm_content}')
            if utm_parts:
                desc_parts.append(f'\nUTM: {", ".join(utm_parts)}')

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

            # Resolve UTM tracking fields (find-or-create)
            if utm_source:
                lead_vals['source_id'] = self._get_or_create_utm(
                    'utm.source', utm_source).id
            if utm_medium:
                lead_vals['medium_id'] = self._get_or_create_utm(
                    'utm.medium', utm_medium).id
            if utm_campaign:
                lead_vals['campaign_id'] = self._get_or_create_utm(
                    'utm.campaign', utm_campaign).id

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

            lead = request.env['crm.lead'].sudo().create(lead_vals)
            _logger.info('MV Landing: CRM opportunity created for %s <%s>', name, email)

            # Build UTM summary for email
            utm_info = ', '.join(utm_parts) if utm_parts else ''

            # Send email notification to admin
            self._send_notification_email(
                lead, name, email, phone, company, interest_label, message,
                crm_note=crm_note, utm_info=utm_info)

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

    @staticmethod
    def _get_or_create_utm(model_name, value):
        """Find or create a UTM record (source/medium/campaign) by name."""
        Model = request.env[model_name].sudo()
        record = Model.search([('name', '=ilike', value)], limit=1)
        if not record:
            record = Model.create({'name': value})
        return record

    def _send_notification_email(self, lead, name, email, phone, company, interest_label, message, crm_note='', utm_info=''):
        """Send notification email about new landing page inquiry."""
        try:
            # Get the website/company email as recipient
            website = request.env['website'].sudo().get_current_website()
            company_email = (
                website.company_id.email
                or request.env.company.sudo().email
                or 'info@michalvarys.eu'
            )

            body_html = f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6699ff, #ff3366); padding: 20px 30px; border-radius: 12px 12px 0 0;">
                    <h2 style="color: #fff; margin: 0;">Nová poptávka z Landing Page</h2>
                </div>
                <div style="background: #1a1a1a; color: #fff; padding: 30px; border-radius: 0 0 12px 12px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #888; width: 140px;">{_("Jméno")}</td>
                            <td style="padding: 8px 0; color: #fff; font-weight: 600;">{name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #888;">E-mail</td>
                            <td style="padding: 8px 0;"><a href="mailto:{email}" style="color: #6699ff;">{email}</a></td>
                        </tr>'''

            if phone:
                body_html += f'''
                        <tr>
                            <td style="padding: 8px 0; color: #888;">{_("Telefon")}</td>
                            <td style="padding: 8px 0; color: #fff;">{phone}</td>
                        </tr>'''

            if company:
                body_html += f'''
                        <tr>
                            <td style="padding: 8px 0; color: #888;">{_("Firma / Web")}</td>
                            <td style="padding: 8px 0; color: #fff;">{company}</td>
                        </tr>'''

            body_html += f'''
                        <tr>
                            <td style="padding: 8px 0; color: #888;">{_("Zájem o")}</td>
                            <td style="padding: 8px 0; color: #ff3366; font-weight: 600;">{interest_label}</td>
                        </tr>
                    </table>'''

            if crm_note:
                body_html += f'''
                    <div style="margin-top: 20px; padding: 16px; background: rgba(102,153,255,0.1); border-radius: 8px; border-left: 3px solid #6699ff;">
                        <p style="color: #888; margin: 0 0 8px; font-size: 13px;">{_("Poznámka")}</p>
                        <p style="color: #fff; margin: 0; line-height: 1.6;">{crm_note}</p>
                    </div>'''

            if message:
                body_html += f'''
                    <div style="margin-top: 20px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid #933df5;">
                        <p style="color: #888; margin: 0 0 8px; font-size: 13px;">{_("Zpráva")}</p>
                        <p style="color: #fff; margin: 0; line-height: 1.6;">{message}</p>
                    </div>'''

            if utm_info:
                body_html += f'''
                    <div style="margin-top: 12px; padding: 8px 16px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                        <p style="color: #555; margin: 0; font-size: 11px;">UTM: {utm_info}</p>
                    </div>'''

            body_html += f'''
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <a href="{lead.get_base_url()}/odoo/crm/{lead.id}"
                           style="display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #6699ff, #ff3366); color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
                            {_("Zobrazit v CRM")}
                        </a>
                    </div>
                </div>
            </div>'''

            mail_values = {
                'subject': f'[Landing] {interest_label} - {name}',
                'body_html': body_html,
                'email_from': email,
                'email_to': company_email,
                'auto_delete': True,
            }
            request.env['mail.mail'].sudo().create(mail_values).send()
            _logger.info('MV Landing: notification email sent to %s', company_email)

        except Exception as e:
            # Don't fail the form submission if email fails
            _logger.warning('MV Landing: failed to send notification email: %s', e)
