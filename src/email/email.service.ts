import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  async sendVenteNotification(
    email: string,
    nomCreatrice: string,
    nomArticle: string,
    prixVente: number,
    montantCommission: number,
    netCreatrice: number,
  ) {
    await this.resend.emails.send({
      from: 'Encaissly <onboarding@resend.dev>',
      to: email,
      subject: `💰 Nouvelle vente enregistrée — ${nomArticle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #311b42; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Encaissly</h1>
            <p style="color: #eb7f45; margin: 5px 0 0 0;">Nouvelle vente enregistrée</p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <p>Bonjour <strong>${nomCreatrice}</strong>,</p>
            <p>Une nouvelle vente a été enregistrée :</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #eb7f45; color: white;">
                <td style="padding: 10px;">Article</td>
                <td style="padding: 10px;">Prix vente</td>
                <td style="padding: 10px;">Commission</td>
                <td style="padding: 10px;">Net créatrice</td>
              </tr>
              <tr style="background: white;">
                <td style="padding: 10px;">${nomArticle}</td>
                <td style="padding: 10px;">${prixVente.toFixed(2)}€</td>
                <td style="padding: 10px; color: #cc0000;">-${montantCommission.toFixed(2)}€</td>
                <td style="padding: 10px; color: #1a7a4a; font-weight: bold;">${netCreatrice.toFixed(2)}€</td>
              </tr>
            </table>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Encaissly — La caisse intelligente des boutiques de créateurs</p>
          </div>
        </div>
      `,
    });
  }
}
