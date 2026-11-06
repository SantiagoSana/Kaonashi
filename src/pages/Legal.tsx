// /legal/privacy and /legal/terms — public pages (also required by Google's OAuth consent screen).
// Content describes exactly what this app collects and why. Have it reviewed by a lawyer before launch.
import React from 'react';
import { Link } from 'wouter';
import { useApp } from '../context/AppContext';
import { Locale } from '../lib/types';

type Section = { h: string; p: string[] };
type Doc = { title: string; updated: string; intro: string; sections: Section[] };

const UPDATED = '2026-11-05';

function privacy(contact: string): Record<Locale, Doc> {
  return {
    es: {
      title: 'Política de privacidad',
      updated: `Última actualización: ${UPDATED}`,
      intro: 'Kaonashi ("nosotros") es el responsable del tratamiento de los datos personales que se recogen en este sitio. Esta política explica qué datos recogemos, para qué los usamos y cómo puedes ejercer tus derechos según la Ley 1581 de 2012 de Colombia y sus decretos reglamentarios.',
      sections: [
        { h: '1. Datos que recogemos', p: [
          'Pedidos y reservas: nombre, teléfono, correo electrónico y, para domicilios, dirección e indicaciones de entrega; productos pedidos, montos y estado del pedido.',
          'Cuenta de cliente (opcional): correo electrónico y nombre. Si ingresas con Google recibimos de Google tu nombre, correo verificado, foto de perfil e identificador de cuenta; no recibimos tu contraseña de Google.',
          'Promociones: si llenas un formulario de una campaña, guardamos tu correo o teléfono, el idioma y si aceptaste recibir mensajes de marketing (casilla desmarcada por defecto).',
          'Escaneos de códigos QR y navegación: fecha y hora, código escaneado, tipo de dispositivo, sistema operativo e idioma del navegador. Tu dirección IP no se guarda: se convierte en un código irreversible que cambia cada día y se usa solo para limitar abusos y contar escaneos únicos.',
          'Programa de puntos: puntos acumulados, nivel y movimientos.',
        ] },
        { h: '2. Para qué los usamos', p: [
          'Preparar, entregar y cobrar tus pedidos y gestionar tus reservas.',
          'Mantener tu cuenta, tus puntos y tu historial.',
          'Entregar los cupones y promociones que solicites y, solo si lo autorizaste, enviarte mensajes de marketing.',
          'Medir de forma agregada qué piezas de publicidad física (portavasos, volantes, etc.) generan visitas y pedidos.',
          'Proteger el servicio: prevenir fraude, abuso de cupones y accesos no autorizados.',
        ] },
        { h: '3. Cookies', p: [
          'Usamos cookies necesarias para la sesión, el carrito y tu billetera de cupones, cookies de preferencia (idioma y moneda, 1 año) y una cookie de atribución que recuerda durante 30 días qué código QR escaneaste. No usamos cookies de publicidad de terceros.',
        ] },
        { h: '4. Con quién compartimos datos', p: [
          'No vendemos tus datos. Los compartimos solo con proveedores que nos prestan servicios y que los tratan por cuenta nuestra: Vercel (alojamiento del sitio), Neon (base de datos), Google (inicio de sesión, si lo usas) y Resend (envío de códigos por correo). Algunos de estos proveedores procesan datos fuera de Colombia, con medidas de seguridad adecuadas.',
          'También podemos entregarlos cuando una autoridad competente lo exija conforme a la ley.',
        ] },
        { h: '5. Cuánto tiempo los conservamos', p: [
          'Mientras tu cuenta esté activa o mientras sea necesario para la finalidad para la que se recogieron, y el tiempo adicional que exijan las normas contables y tributarias.',
        ] },
        { h: '6. Tus derechos', p: [
          'Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, revocar la autorización y pedir prueba de ella. Desde "Mi cuenta" puedes editar tu perfil y eliminar tu cuenta; al hacerlo, tus datos de contacto se anonimizan. Cada mensaje de marketing incluye un enlace para darte de baja.',
          `Para cualquier solicitud escríbenos a ${contact}. Responderemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles. Si no quedas satisfecho, puedes acudir a la Superintendencia de Industria y Comercio (SIC).`,
        ] },
        { h: '7. Seguridad', p: [
          'Las conexiones van cifradas (HTTPS), las contraseñas del personal se guardan con hash, el acceso administrativo requiere sesión y permisos por rol, y las operaciones sensibles quedan registradas en un registro de auditoría.',
        ] },
        { h: '8. Menores de edad', p: ['Este servicio está dirigido a mayores de edad. La venta de bebidas alcohólicas solo se hace a mayores de 18 años.'] },
        { h: '9. Cambios', p: ['Si cambiamos esta política publicaremos la nueva versión en esta página con su fecha de actualización.'] },
      ],
    },
    en: {
      title: 'Privacy policy',
      updated: `Last updated: ${UPDATED}`,
      intro: 'Kaonashi ("we") is the controller of the personal data collected on this site. This policy explains what we collect, why, and how you can exercise your rights under Colombian Law 1581 of 2012.',
      sections: [
        { h: '1. Data we collect', p: [
          'Orders and reservations: name, phone, e-mail and, for delivery, address and instructions; items ordered, amounts and order status.',
          'Customer account (optional): e-mail and name. If you sign in with Google we receive your name, verified e-mail, profile photo and account identifier from Google; we never receive your Google password.',
          'Promotions: if you fill in a campaign form we store your e-mail or phone, language and whether you agreed to marketing messages (unchecked by default).',
          'QR scans and browsing: date and time, code scanned, device type, operating system and browser language. Your IP address is not stored: it is turned into an irreversible code that changes daily, used only to prevent abuse and count unique scans.',
          'Rewards program: points, tier and point movements.',
        ] },
        { h: '2. Why we use it', p: [
          'To prepare, deliver and charge your orders and manage your reservations.',
          'To keep your account, points and history.',
          'To deliver the coupons you request and, only if you agreed, send you marketing messages.',
          'To measure, in aggregate, which printed materials (coasters, flyers, etc.) lead to visits and orders.',
          'To protect the service against fraud, coupon abuse and unauthorized access.',
        ] },
        { h: '3. Cookies', p: ['We use cookies needed for your session, cart and coupon wallet, preference cookies (language and currency, 1 year) and an attribution cookie that remembers for 30 days which QR code you scanned. We do not use third-party advertising cookies.'] },
        { h: '4. Who we share it with', p: [
          'We do not sell your data. We share it only with providers that process it on our behalf: Vercel (hosting), Neon (database), Google (sign-in, if you use it) and Resend (code e-mails). Some process data outside Colombia with appropriate safeguards.',
          'We may also disclose it when a competent authority requires it by law.',
        ] },
        { h: '5. Retention', p: ['While your account is active or as long as needed for the purpose it was collected for, plus any period required by accounting and tax rules.'] },
        { h: '6. Your rights', p: [
          'You may access, update, correct and request deletion of your data, revoke your consent and request proof of it. In "My account" you can edit your profile and delete your account, which anonymizes your contact data. Every marketing message includes an unsubscribe link.',
          `For any request write to ${contact}. We answer queries within 10 business days and complaints within 15 business days. You may also contact Colombia's Superintendence of Industry and Commerce (SIC).`,
        ] },
        { h: '7. Security', p: ['Connections are encrypted (HTTPS), staff passwords are stored hashed, admin access requires a session and role permissions, and sensitive operations are written to an audit log.'] },
        { h: '8. Minors', p: ['This service is intended for adults. Alcoholic beverages are only sold to people aged 18 or over.'] },
        { h: '9. Changes', p: ['If we change this policy we will publish the new version on this page with its update date.'] },
      ],
    },
    ja: {
      title: 'プライバシーポリシー',
      updated: `最終更新日: ${UPDATED}`,
      intro: 'Kaonashi（以下「当店」）は、本サイトで取得する個人データの管理者です。本ポリシーでは、取得するデータ、その利用目的、およびコロンビア法1581号（2012年）に基づくお客様の権利の行使方法を説明します。',
      sections: [
        { h: '1. 取得するデータ', p: [
          'ご注文・ご予約：氏名、電話番号、メールアドレス、配達の場合は住所と配達メモ、注文内容、金額、注文状況。',
          'お客様アカウント（任意）：メールアドレスと氏名。Googleでログインした場合、Googleから氏名、確認済みメールアドレス、プロフィール写真、アカウントIDを受け取ります。Googleのパスワードは受け取りません。',
          'キャンペーン：フォームに入力された場合、メールまたは電話番号、言語、マーケティング配信への同意の有無（初期値は未選択）を保存します。',
          'QRスキャンと閲覧：日時、スキャンしたコード、端末の種類、OS、ブラウザの言語。IPアドレスは保存せず、毎日変わる不可逆なコードに変換し、不正防止とユニークスキャンの集計にのみ使用します。',
          'ポイントプログラム：ポイント、ランク、ポイント履歴。',
        ] },
        { h: '2. 利用目的', p: [
          'ご注文の調理・配達・決済およびご予約の管理。',
          'アカウント、ポイント、履歴の維持。',
          'ご希望のクーポンの提供、および同意いただいた場合に限りマーケティング情報の送信。',
          'コースターやチラシなどの販促物が来店・注文につながったかの集計的な測定。',
          '不正、クーポンの悪用、不正アクセスからのサービス保護。',
        ] },
        { h: '3. Cookie', p: ['セッション、カート、クーポンウォレットに必要なCookie、言語と通貨の設定Cookie（1年）、スキャンしたQRコードを30日間記録するアトリビューションCookieを使用します。第三者の広告Cookieは使用しません。'] },
        { h: '4. 第三者への提供', p: [
          '個人データを販売することはありません。当店に代わって処理を行う委託先（Vercel：ホスティング、Neon：データベース、Google：ログイン、Resend：コードのメール送信）にのみ提供します。一部はコロンビア国外で適切な保護措置のもと処理されます。',
          '法令に基づき権限ある当局から求められた場合は開示することがあります。',
        ] },
        { h: '5. 保存期間', p: ['アカウントが有効な間、または取得目的に必要な期間、および会計・税務上の法令が求める期間保存します。'] },
        { h: '6. お客様の権利', p: [
          'ご自身のデータの確認、更新、訂正、削除の請求、同意の撤回、同意の証明の請求ができます。「マイアカウント」でプロフィールの編集とアカウント削除（連絡先データは匿名化されます）が可能です。マーケティングメッセージには必ず配信停止リンクが含まれます。',
          `ご請求は ${contact} までご連絡ください。お問い合わせには10営業日以内、苦情には15営業日以内に回答します。コロンビア商工監督庁（SIC）に申し立てることもできます。`,
        ] },
        { h: '7. セキュリティ', p: ['通信はHTTPSで暗号化され、スタッフのパスワードはハッシュ化して保存し、管理画面へのアクセスにはセッションと権限が必要で、重要な操作は監査ログに記録されます。'] },
        { h: '8. 未成年者', p: ['本サービスは成人を対象としています。アルコール飲料は18歳以上の方にのみ販売します。'] },
        { h: '9. 変更', p: ['本ポリシーを変更する場合は、更新日とともに本ページに掲載します。'] },
      ],
    },
  };
}

function terms(contact: string): Record<Locale, Doc> {
  return {
    es: {
      title: 'Términos y condiciones',
      updated: `Última actualización: ${UPDATED}`,
      intro: 'Al usar este sitio para hacer pedidos, reservas o reclamar promociones aceptas estas condiciones.',
      sections: [
        { h: '1. Pedidos', p: ['Los precios, impuestos y descuentos que se cobran son los que calcula nuestro sistema al confirmar el pedido. Los pedidos con mesa escrita a mano y los domicilios deben ser confirmados por el restaurante; si no se confirman en 10 minutos se cancelan sin costo.'] },
        { h: '2. Cupones y promociones', p: ['Cada cupón tiene vigencia, condiciones de compra mínima y límites de uso que se muestran al aplicarlo. No son canjeables por dinero ni acumulables salvo que se indique. Podemos anular cupones obtenidos de forma fraudulenta.'] },
        { h: '3. Reservas', p: ['El depósito de las reservas se reembolsa si cancelas con al menos 24 horas de anticipación; si no asistes sin cancelar, el depósito no se reembolsa.'] },
        { h: '4. Alérgenos', p: ['La información de alérgenos se basa en nuestras recetas, pero en la cocina se manipulan pescados, mariscos, soya, sésamo, gluten y otros alérgenos. Si tienes una alergia severa, confírmalo con nuestro personal antes de pedir.'] },
        { h: '5. Bebidas alcohólicas', p: ['Solo se venden a mayores de 18 años; podemos pedir documento de identidad al entregar.'] },
        { h: '6. Cuentas', p: ['Eres responsable del acceso a tu correo o cuenta de Google con los que ingresas. Puedes eliminar tu cuenta en cualquier momento desde "Mi cuenta".'] },
        { h: '7. Contacto', p: [`Para preguntas o reclamos escríbenos a ${contact}. El tratamiento de datos personales se rige por nuestra Política de privacidad.`] },
      ],
    },
    en: {
      title: 'Terms and conditions',
      updated: `Last updated: ${UPDATED}`,
      intro: 'By using this site to place orders, make reservations or claim promotions you accept these terms.',
      sections: [
        { h: '1. Orders', p: ['Prices, taxes and discounts charged are those calculated by our system when the order is confirmed. Orders with a hand-typed table and deliveries must be confirmed by the restaurant; unconfirmed orders are cancelled at no cost after 10 minutes.'] },
        { h: '2. Coupons and promotions', p: ['Each coupon has a validity period, minimum spend and usage limits shown when applied. They cannot be exchanged for cash or combined unless stated. We may void coupons obtained fraudulently.'] },
        { h: '3. Reservations', p: ['Reservation deposits are refunded if you cancel at least 24 hours in advance; no-shows forfeit the deposit.'] },
        { h: '4. Allergens', p: ['Allergen information is based on our recipes, but our kitchen handles fish, shellfish, soy, sesame, gluten and other allergens. If you have a severe allergy, confirm with our staff before ordering.'] },
        { h: '5. Alcohol', p: ['Only sold to people aged 18 or over; ID may be requested on delivery.'] },
        { h: '6. Accounts', p: ['You are responsible for access to the e-mail or Google account you sign in with. You can delete your account at any time from "My account".'] },
        { h: '7. Contact', p: [`For questions or complaints write to ${contact}. Personal data is handled under our Privacy policy.`] },
      ],
    },
    ja: {
      title: '利用規約',
      updated: `最終更新日: ${UPDATED}`,
      intro: '本サイトで注文、予約、またはキャンペーンの利用を行うことで、本規約に同意したものとみなされます。',
      sections: [
        { h: '1. ご注文', p: ['請求される価格、税、割引は注文確定時に当店のシステムが計算したものです。手入力のテーブル番号による注文と配達は店舗の確認が必要で、10分以内に確認されない場合は無料でキャンセルされます。'] },
        { h: '2. クーポン', p: ['各クーポンには有効期間、最低購入金額、利用回数の上限があり、適用時に表示されます。現金との交換や併用はできません（記載がある場合を除く）。不正に取得されたクーポンは無効にすることがあります。'] },
        { h: '3. ご予約', p: ['24時間前までにキャンセルされた場合、予約金は返金されます。連絡なく来店されなかった場合は返金されません。'] },
        { h: '4. アレルゲン', p: ['アレルゲン情報はレシピに基づきますが、厨房では魚、甲殻類、大豆、ごま、小麦などを扱っています。重度のアレルギーがある場合はご注文前にスタッフにご確認ください。'] },
        { h: '5. アルコール', p: ['18歳以上の方にのみ販売し、身分証明書の提示を求めることがあります。'] },
        { h: '6. アカウント', p: ['ログインに使用するメールまたはGoogleアカウントの管理はお客様の責任となります。「マイアカウント」からいつでも削除できます。'] },
        { h: '7. お問い合わせ', p: [`ご質問・苦情は ${contact} までご連絡ください。個人データの取り扱いはプライバシーポリシーに従います。`] },
      ],
    },
  };
}

export const Legal: React.FC<{ kind: 'privacy' | 'terms' }> = ({ kind }) => {
  const { locale, config } = useApp();
  const contact = config?.privacyContact || 'privacidad@kaonashi.co';
  const doc = (kind === 'privacy' ? privacy(contact) : terms(contact))[locale] || (kind === 'privacy' ? privacy(contact) : terms(contact)).es;
  const other = kind === 'privacy' ? { href: '/legal/terms', label: terms(contact)[locale].title } : { href: '/legal/privacy', label: privacy(contact)[locale].title };

  React.useEffect(() => {
    document.title = `${doc.title} · Kaonashi`;
  }, [doc.title]);

  return (
    <article className="max-w-2xl mx-auto px-4 py-10 pb-28 space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold">{doc.title}</h1>
        <p className="text-xs text-[rgb(var(--muted))]">{doc.updated}</p>
      </header>
      <p className="text-sm leading-relaxed">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h} className="space-y-2">
          <h2 className="font-display text-lg font-bold">{s.h}</h2>
          {s.p.map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-[rgb(var(--text))]/90">{para}</p>
          ))}
        </section>
      ))}
      <p className="text-sm pt-4 border-t border-white/10">
        <Link href={other.href} className="text-[rgb(var(--primary))] hover:underline">{other.label}</Link>
      </p>
    </article>
  );
};
