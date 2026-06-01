import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class EmailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async sendVenteNotification(
    email: string,
    nomCreatrice: string,
    nomArticle: string,
    prixVente: number,
    montantCommission: number,
    netCreatrice: number,
  ) {
    //- En dev/sandbox : rediriger vers l'adresse de test si configurée
    const recipient = process.env.RESEND_OVERRIDE_EMAIL ?? email;
    const { data, error } = await this.resend.emails.send({
      from: 'Encaissly <onboarding@resend.dev>',
      to: recipient,
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
    if (error) {
      console.error(`[Email] sendVenteNotification ERREUR → ${recipient}:`, error);
    } else {
      console.log(`[Email] sendVenteNotification OK → ${recipient} (id: ${data?.id})`);
    }
  }

  //- S'exécute automatiquement le 1er de chaque mois à minuit
  //- Envoie un récap mensuel à chaque créatrice PRO avec un compte User lié
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async sendRecapMensuel() {
    //- Récupère le 1er et dernier jour du mois précédent
    const maintenant = new Date();
    const debutMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth() - 1,
      1,
    );
    const finMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      0,
      23,
      59,
      59,
    );

    //- Récupère toutes les créatrices liées à un User PRO avec notifications activées
    const creatrices = await this.prisma.creatrice.findMany({
      where: {
        user: {
          plan: 'PRO',
          notificationsEmail: true,
        },
      },
      include: {
        user: true,
        vente: {
          where: {
            createdAt: {
              gte: debutMois,
              lte: finMois,
            },
          },
        },
      },
    });

    for (const creatrice of creatrices) {
      //- Skip si pas de ventes ce mois-ci
      if (creatrice.vente.length === 0) continue;

      //- Calcul des totaux
      let totalCA = 0;
      let totalCommission = 0;
      let totalNet = 0;

      const lignesVentes = creatrice.vente
        .map((vente) => {
          const commission =
            (vente.prixVente * creatrice.tauxDeCommission) / 100;
          const net = vente.prixVente - commission;
          totalCA += vente.prixVente;
          totalCommission += commission;
          totalNet += net;

          return `
          <tr style="background: white;">
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${vente.nomArticle}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${vente.prixVente.toFixed(2)}€</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #cc0000;">-${commission.toFixed(2)}€</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; color: #1a7a4a; font-weight: bold;">${net.toFixed(2)}€</td>
          </tr>
        `;
        })
        .join('');

      const moisNom = debutMois.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });

      //- En dev/sandbox : rediriger vers l'adresse de test si configurée
      const recipientRecap = process.env.RESEND_OVERRIDE_EMAIL ?? creatrice.user!.email;
      await this.resend.emails.send({
        from: 'Encaissly <onboarding@resend.dev>',
        to: recipientRecap,
        subject: `📊 Récap de vos ventes — ${moisNom}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #311b42; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">Encaissly</h1>
              <p style="color: #eb7f45; margin: 5px 0 0 0;">Récap mensuel — ${moisNom}</p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
              <p>Bonjour <strong>${creatrice.nom}</strong>,</p>
              <p>Voici le récap de vos ventes pour ${moisNom} :</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #eb7f45; color: white;">
                  <td style="padding: 10px;">Article</td>
                  <td style="padding: 10px;">Prix vente</td>
                  <td style="padding: 10px;">Commission</td>
                  <td style="padding: 10px;">Net</td>
                </tr>
                ${lignesVentes}
                <tr style="background: #311b42; color: white;">
                  <td style="padding: 10px; font-weight: bold;">TOTAL</td>
                  <td style="padding: 10px; font-weight: bold;">${totalCA.toFixed(2)}€</td>
                  <td style="padding: 10px; color: #ffaaaa;">-${totalCommission.toFixed(2)}€</td>
                  <td style="padding: 10px; color: #aaffcc; font-weight: bold;">${totalNet.toFixed(2)}€</td>
                </tr>
              </table>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">Encaissly — La caisse intelligente des boutiques de créateurs</p>
            </div>
          </div>
        `,
      });
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async sendRecapMensuelBoutique() {
    const maintenant = new Date();
    const debutMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth() - 1,
      1,
    );
    const finMois = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      0,
      23,
      59,
      59,
    );

    const boutique = await this.prisma.boutique.findMany({
      include: {
        gerante: true,
        ventes: {
          where: {
            createdAt: { gte: debutMois, lte: finMois },
          },
          include: { creatrice: true },
        },
      },
      where: {
        gerante: { notificationsEmail: true },
      },
    });

    for (const boutiques of boutique) {
      if (boutiques.ventes.length === 0) continue;

      //- Réinitialise pour chaque boutique
      const resumeParCreatrice: Record<
        string,
        {
          nom: string;
          taux: number;
          total: number;
          commission: number;
          net: number;
        }
      > = {};

      let totalCA = 0;
      let totalCommission = 0;
      let totalNet = 0;

      for (const vente of boutiques.ventes) {
        const commission =
          (vente.prixVente * vente.creatrice.tauxDeCommission) / 100;
        const net = vente.prixVente - commission;

        if (!resumeParCreatrice[vente.creatriceId]) {
          resumeParCreatrice[vente.creatriceId] = {
            nom: vente.creatrice.nom,
            taux: vente.creatrice.tauxDeCommission,
            total: 0,
            commission: 0,
            net: 0,
          };
        }

        resumeParCreatrice[vente.creatriceId].total += vente.prixVente;
        resumeParCreatrice[vente.creatriceId].commission += commission;
        resumeParCreatrice[vente.creatriceId].net += net;

        totalCA += vente.prixVente;
        totalCommission += commission;
        totalNet += net;
      }

      const lignesCreatrices = Object.values(resumeParCreatrice)
        .map(
          (c) => `
      <tr style="background: white;">
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.nom}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${c.taux}%</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${c.total.toFixed(2)}€</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: #cc0000;">-${c.commission.toFixed(2)}€</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: #1a7a4a; font-weight: bold;">${c.net.toFixed(2)}€</td>
      </tr>
    `,
        )
        .join('');

      const moisNom = debutMois.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });

      //- En dev/sandbox : rediriger vers l'adresse de test si configurée
      const recipientBoutique = process.env.RESEND_OVERRIDE_EMAIL ?? boutiques.gerante.email;
      await this.resend.emails.send({
        from: 'Encaissly <onboarding@resend.dev>',
        to: recipientBoutique,
        subject: `📊 Récap boutique — ${boutiques.nom} — ${moisNom}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #311b42; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Encaissly</h1>
            <p style="color: #eb7f45; margin: 5px 0 0 0;">Récap boutique — ${moisNom}</p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <p>Bonjour,</p>
            <p>Voici le récap de votre boutique <strong>${boutiques.nom}</strong> pour ${moisNom} :</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #eb7f45; color: white;">
                <td style="padding: 10px;">Créatrice</td>
                <td style="padding: 10px;">Taux</td>
                <td style="padding: 10px;">CA total</td>
                <td style="padding: 10px;">Commission</td>
                <td style="padding: 10px;">Net</td>
              </tr>
              ${lignesCreatrices}
              <tr style="background: #311b42; color: white;">
                <td style="padding: 10px; font-weight: bold;" colspan="2">TOTAL</td>
                <td style="padding: 10px; font-weight: bold;">${totalCA.toFixed(2)}€</td>
                <td style="padding: 10px; color: #ffaaaa;">-${totalCommission.toFixed(2)}€</td>
                <td style="padding: 10px; color: #aaffcc; font-weight: bold;">${totalNet.toFixed(2)}€</td>
              </tr>
            </table>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Encaissly — La caisse intelligente des boutiques de créateurs</p>
          </div>
        </div>
      `,
      });
    }
  }

  async sendInvitation(email: string, nomCreatrice: string) {
    //- En dev/sandbox : rediriger vers l'adresse de test si configurée
    const recipient = process.env.RESEND_OVERRIDE_EMAIL ?? email;
    await this.resend.emails.send({
      from: 'Encaissly <onboarding@resend.dev>',
      to: recipient,
      subject: `🎉 Vous avez été invitée sur Encaissly`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #311b42; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Encaissly</h1>
          <p style="color: #eb7f45; margin: 5px 0 0 0;">Invitation créatrice</p>
        </div>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${nomCreatrice}</strong>,</p>
          <p>Vous avez été invitée à rejoindre une boutique sur <strong>Encaissly</strong>.</p>
          <p>Téléchargez l'application et créez votre compte avec cette adresse email pour accéder à vos ventes et commissions.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background: #7a41bb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Créer mon compte
            </a>
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">Encaissly — La caisse intelligente des boutiques de créateurs</p>
        </div>
      </div>
    `,
    });
  }
}
