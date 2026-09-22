import type { InviteLocale } from '../../lib/invite-locale'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { escapeHtml, renderTransactionalEmail } from './html'

type AuthCopy = {
  ignoreEmail: string
  magicLinkSubject: string
  magicLinkPreheader: string
  magicLinkIntro: string
  magicLinkFootnote: string
  magicLinkCta: string
  passwordResetSubject: string
  passwordResetPreheader: string
  passwordResetIntro: string
  passwordResetFootnote: string
  passwordResetCta: string
  verifyEmailSubject: string
  verifyEmailPreheader: string
  verifyEmailIntro: string
  verifyEmailFootnote: string
  verifyEmailCta: string
}

const copy: Record<InviteLocale, AuthCopy> = {
  en: {
    ignoreEmail: 'If you did not request this, you can ignore this email.',
    magicLinkSubject: 'Sign in to {appName}',
    magicLinkPreheader: 'Your sign-in link expires in a few minutes.',
    magicLinkIntro:
      'Use the button below to sign in to {appName}. This link expires in a few minutes.',
    magicLinkFootnote: 'For your security, do not share this link with anyone.',
    magicLinkCta: 'Sign in',
    passwordResetSubject: 'Reset your {appName} password',
    passwordResetPreheader: 'Create a new password for your account.',
    passwordResetIntro:
      'We received a request to reset your {appName} password. Use the button below to choose a new one.',
    passwordResetFootnote:
      'If you did not request a password reset, you can safely ignore this email.',
    passwordResetCta: 'Reset password',
    verifyEmailSubject: 'Verify your email for {appName}',
    verifyEmailPreheader:
      'Confirm your email address to finish setting up your account.',
    verifyEmailIntro:
      'Please verify your email address to start using {appName}.',
    verifyEmailFootnote:
      'If you did not create an account, you can ignore this email.',
    verifyEmailCta: 'Verify email',
  },
  sv: {
    ignoreEmail: 'Om du inte begärde det här kan du ignorera mejlet.',
    magicLinkSubject: 'Logga in på {appName}',
    magicLinkPreheader: 'Din inloggningslänk går ut om några minuter.',
    magicLinkIntro:
      'Använd knappen nedan för att logga in på {appName}. Länken går ut om några minuter.',
    magicLinkFootnote: 'Dela inte länken med någon annan.',
    magicLinkCta: 'Logga in',
    passwordResetSubject: 'Återställ ditt lösenord för {appName}',
    passwordResetPreheader: 'Skapa ett nytt lösenord för ditt konto.',
    passwordResetIntro:
      'Vi fick en begäran om att återställa ditt lösenord för {appName}. Använd knappen nedan.',
    passwordResetFootnote: 'Om du inte begärde detta kan du ignorera mejlet.',
    passwordResetCta: 'Återställ lösenord',
    verifyEmailSubject: 'Verifiera din e-post för {appName}',
    verifyEmailPreheader: 'Bekräfta din e-postadress för att slutföra kontot.',
    verifyEmailIntro:
      'Verifiera din e-postadress för att börja använda {appName}.',
    verifyEmailFootnote: 'Om du inte skapade kontot kan du ignorera mejlet.',
    verifyEmailCta: 'Verifiera e-post',
  },
  da: {
    ignoreEmail: 'Hvis du ikke anmodede om dette, kan du ignorere e-mailen.',
    magicLinkSubject: 'Log ind på {appName}',
    magicLinkPreheader: 'Dit login-link udløber om få minutter.',
    magicLinkIntro:
      'Brug knappen nedenfor til at logge ind på {appName}. Linket udløber om få minuter.',
    magicLinkFootnote: 'Del ikke linket med andre.',
    magicLinkCta: 'Log ind',
    passwordResetSubject: 'Nulstil din adgangskode til {appName}',
    passwordResetPreheader: 'Opret en ny adgangskode til din konto.',
    passwordResetIntro:
      'Vi modtog en anmodning om at nulstille din adgangskode til {appName}. Brug knappen nedenfor.',
    passwordResetFootnote:
      'Hvis du ikke anmodede om dette, kan du ignorere e-mailen.',
    passwordResetCta: 'Nulstil adgangskode',
    verifyEmailSubject: 'Bekræft din e-mail til {appName}',
    verifyEmailPreheader:
      'Bekræft din e-mailadresse for at færdiggøre kontoen.',
    verifyEmailIntro: 'Bekræft din e-mailadresse for at bruge {appName}.',
    verifyEmailFootnote:
      'Hvis du ikke oprettede kontoen, kan du ignorere e-mailen.',
    verifyEmailCta: 'Bekræft e-mail',
  },
  de: {
    ignoreEmail:
      'Wenn du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.',
    magicLinkSubject: 'Bei {appName} anmelden',
    magicLinkPreheader: 'Dein Anmeldelink läuft in wenigen Minuten ab.',
    magicLinkIntro:
      'Nutze die Schaltfläche unten, um dich bei {appName} anzumelden. Der Link läuft in wenigen Minuten ab.',
    magicLinkFootnote: 'Teile diesen Link aus Sicherheitsgründen nicht.',
    magicLinkCta: 'Anmelden',
    passwordResetSubject: 'Passwort für {appName} zurücksetzen',
    passwordResetPreheader: 'Lege ein neues Passwort für dein Konto fest.',
    passwordResetIntro:
      'Wir haben eine Anfrage erhalten, dein Passwort für {appName} zurückzusetzen. Nutze die Schaltfläche unten.',
    passwordResetFootnote:
      'Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.',
    passwordResetCta: 'Passwort zurücksetzen',
    verifyEmailSubject: 'E-Mail für {appName} bestätigen',
    verifyEmailPreheader:
      'Bestätige deine E-Mail-Adresse, um das Konto abzuschließen.',
    verifyEmailIntro:
      'Bitte bestätige deine E-Mail-Adresse, um {appName} zu nutzen.',
    verifyEmailFootnote:
      'Wenn du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.',
    verifyEmailCta: 'E-Mail bestätigen',
  },
  es: {
    ignoreEmail: 'Si no solicitaste esto, puedes ignorar el correo.',
    magicLinkSubject: 'Iniciar sesión en {appName}',
    magicLinkPreheader: 'Tu enlace de acceso caduca en unos minutos.',
    magicLinkIntro:
      'Usa el botón de abajo para iniciar sesión en {appName}. El enlace caduca en unos minutos.',
    magicLinkFootnote: 'Por seguridad, no compartas este enlace.',
    magicLinkCta: 'Iniciar sesión',
    passwordResetSubject: 'Restablecer tu contraseña de {appName}',
    passwordResetPreheader: 'Crea una nueva contraseña para tu cuenta.',
    passwordResetIntro:
      'Recibimos una solicitud para restablecer tu contraseña de {appName}. Usa el botón de abajo.',
    passwordResetFootnote: 'Si no lo solicitaste, puedes ignorar el correo.',
    passwordResetCta: 'Restablecer contraseña',
    verifyEmailSubject: 'Verifica tu correo para {appName}',
    verifyEmailPreheader:
      'Confirma tu correo para terminar de crear la cuenta.',
    verifyEmailIntro: 'Verifica tu correo para empezar a usar {appName}.',
    verifyEmailFootnote: 'Si no creaste la cuenta, puedes ignorar el correo.',
    verifyEmailCta: 'Verificar correo',
  },
  fr: {
    ignoreEmail: 'Si vous n’avez pas demandé ceci, ignorez cet e-mail.',
    magicLinkSubject: 'Se connecter à {appName}',
    magicLinkPreheader: 'Votre lien de connexion expire dans quelques minutes.',
    magicLinkIntro:
      'Utilisez le bouton ci-dessous pour vous connecter à {appName}. Le lien expire dans quelques minutes.',
    magicLinkFootnote: 'Pour votre sécurité, ne partagez pas ce lien.',
    magicLinkCta: 'Se connecter',
    passwordResetSubject: 'Réinitialiser votre mot de passe {appName}',
    passwordResetPreheader:
      'Choisissez un nouveau mot de passe pour votre compte.',
    passwordResetIntro:
      'Nous avons reçu une demande de réinitialisation de votre mot de passe {appName}. Utilisez le bouton ci-dessous.',
    passwordResetFootnote:
      'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
    passwordResetCta: 'Réinitialiser le mot de passe',
    verifyEmailSubject: 'Vérifiez votre e-mail pour {appName}',
    verifyEmailPreheader:
      'Confirmez votre adresse e-mail pour finaliser le compte.',
    verifyEmailIntro: 'Veuillez vérifier votre e-mail pour utiliser {appName}.',
    verifyEmailFootnote:
      'Si vous n’avez pas créé de compte, ignorez cet e-mail.',
    verifyEmailCta: 'Vérifier l’e-mail',
  },
  nl: {
    ignoreEmail: 'Als je dit niet hebt aangevraagd, kun je de e-mail negeren.',
    magicLinkSubject: 'Inloggen op {appName}',
    magicLinkPreheader: 'Je inloglink verloopt over enkele minuten.',
    magicLinkIntro:
      'Gebruik de knop hieronder om in te loggen op {appName}. De link verloopt over enkele minuten.',
    magicLinkFootnote: 'Deel deze link om veiligheidsredenen niet.',
    magicLinkCta: 'Inloggen',
    passwordResetSubject: 'Wachtwoord voor {appName} resetten',
    passwordResetPreheader: 'Kies een nieuw wachtwoord voor je account.',
    passwordResetIntro:
      'We hebben een verzoek ontvangen om je wachtwoord voor {appName} te resetten. Gebruik de knop hieronder.',
    passwordResetFootnote:
      'Als je dit niet hebt aangevraagd, negeer de e-mail.',
    passwordResetCta: 'Wachtwoord resetten',
    verifyEmailSubject: 'Bevestig je e-mail voor {appName}',
    verifyEmailPreheader: 'Bevestig je e-mailadres om je account af te ronden.',
    verifyEmailIntro: 'Bevestig je e-mailadres om {appName} te gebruiken.',
    verifyEmailFootnote:
      'Als je geen account hebt aangemaakt, negeer de e-mail.',
    verifyEmailCta: 'E-mail bevestigen',
  },
  pt: {
    ignoreEmail: 'Se não solicitou isto, pode ignorar o e-mail.',
    magicLinkSubject: 'Iniciar sessão em {appName}',
    magicLinkPreheader: 'A sua ligação de acesso expira em poucos minutos.',
    magicLinkIntro:
      'Use o botão abaixo para iniciar sessão em {appName}. A ligação expira em poucos minutos.',
    magicLinkFootnote: 'Por segurança, não partilhe esta ligação.',
    magicLinkCta: 'Iniciar sessão',
    passwordResetSubject: 'Repor a palavra-passe de {appName}',
    passwordResetPreheader: 'Crie uma nova palavra-passe para a sua conta.',
    passwordResetIntro:
      'Recebemos um pedido para repor a palavra-passe de {appName}. Use o botão abaixo.',
    passwordResetFootnote: 'Se não fez este pedido, ignore o e-mail.',
    passwordResetCta: 'Repor palavra-passe',
    verifyEmailSubject: 'Verifique o seu e-mail para {appName}',
    verifyEmailPreheader: 'Confirme o e-mail para concluir a conta.',
    verifyEmailIntro: 'Verifique o seu e-mail para começar a usar {appName}.',
    verifyEmailFootnote: 'Se não criou a conta, ignore o e-mail.',
    verifyEmailCta: 'Verificar e-mail',
  },
  fi: {
    ignoreEmail: 'Jos et pyytänyt tätä, voit jättää viestin huomiotta.',
    magicLinkSubject: 'Kirjaudu palveluun {appName}',
    magicLinkPreheader: 'Kirjautumislinkki vanhenee muutamassa minuutissa.',
    magicLinkIntro:
      'Kirjaudu {appName}-palveluun alla olevalla painikkeella. Linkki vanhenee muutamassa minuutissa.',
    magicLinkFootnote: 'Älä jaa linkkiä turvallisuussyistä.',
    magicLinkCta: 'Kirjaudu',
    passwordResetSubject: 'Vaihda {appName}-salasanasi',
    passwordResetPreheader: 'Luo tilillesi uusi salasana.',
    passwordResetIntro:
      'Saimme pyynnön vaihtaa {appName}-salasanasi. Käytä alla olevaa painiketta.',
    passwordResetFootnote:
      'Jos et pyytänyt tätä, voit jättää viestin huomiotta.',
    passwordResetCta: 'Vaihda salasana',
    verifyEmailSubject: 'Vahvista sähköpostisi palvelussa {appName}',
    verifyEmailPreheader: 'Vahvista sähköpostiosoite viimeistelläksesi tilin.',
    verifyEmailIntro:
      'Vahvista sähköpostisi aloittaaksesi {appName}-palvelun käytön.',
    verifyEmailFootnote: 'Jos et luonut tiliä, voit jättää viestin huomiotta.',
    verifyEmailCta: 'Vahvista sähköposti',
  },
  el: {
    ignoreEmail: 'Αν δεν το ζητήσατε, μπορείτε να αγνοήσετε το email.',
    magicLinkSubject: 'Σύνδεση στο {appName}',
    magicLinkPreheader: 'Ο σύνδεσμος σύνδεσης λήγει σε λίγα λεπτά.',
    magicLinkIntro:
      'Χρησιμοποιήστε το κουμπί παρακάτω για σύνδεση στο {appName}. Ο σύνδεσμος λήγει σε λίγα λεπτά.',
    magicLinkFootnote: 'Μην μοιράζεστε τον σύνδεσμο.',
    magicLinkCta: 'Σύνδεση',
    passwordResetSubject: 'Επαναφορά κωδικού για {appName}',
    passwordResetPreheader: 'Δημιουργήστε νέο κωδικό για τον λογαριασμό σας.',
    passwordResetIntro:
      'Λάβαμε αίτημα επαναφοράς κωδικού για {appName}. Χρησιμοποιήστε το κουμπί παρακάτω.',
    passwordResetFootnote: 'Αν δεν το ζητήσατε, αγνοήστε το email.',
    passwordResetCta: 'Επαναφορά κωδικού',
    verifyEmailSubject: 'Επιβεβαιώστε το email για {appName}',
    verifyEmailPreheader:
      'Επιβεβαιώστε τη διεύθυνση email για να ολοκληρώσετε τον λογαριασμό.',
    verifyEmailIntro:
      'Επιβεβαιώστε το email σας για να χρησιμοποιήσετε το {appName}.',
    verifyEmailFootnote: 'Αν δεν δημιουργήσατε λογαριασμό, αγνοήστε το email.',
    verifyEmailCta: 'Επιβεβαίωση email',
  },
  tr: {
    ignoreEmail: 'Bunu siz istemediyseniz e-postayı yok sayabilirsiniz.',
    magicLinkSubject: '{appName} hesabına giriş yap',
    magicLinkPreheader: 'Giriş bağlantınız birkaç dakika içinde sona erer.',
    magicLinkIntro:
      '{appName} hesabına giriş yapmak için aşağıdaki düğmeyi kullanın. Bağlantı birkaç dakika içinde sona erer.',
    magicLinkFootnote: 'Güvenliğiniz için bu bağlantıyı paylaşmayın.',
    magicLinkCta: 'Giriş yap',
    passwordResetSubject: '{appName} parolanızı sıfırlayın',
    passwordResetPreheader: 'Hesabınız için yeni bir parola oluşturun.',
    passwordResetIntro:
      '{appName} parolanızı sıfırlama isteği aldık. Aşağıdaki düğmeyi kullanın.',
    passwordResetFootnote: 'Bunu siz istemediyseniz e-postayı yok sayın.',
    passwordResetCta: 'Parolayı sıfırla',
    verifyEmailSubject: '{appName} için e-postanızı doğrulayın',
    verifyEmailPreheader: 'Hesabınızı tamamlamak için e-postanızı onaylayın.',
    verifyEmailIntro:
      '{appName} kullanmaya başlamak için e-postanızı doğrulayın.',
    verifyEmailFootnote: 'Hesap oluşturmadıysanız e-postayı yok sayın.',
    verifyEmailCta: 'E-postayı doğrula',
  },
  vi: {
    ignoreEmail: 'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    magicLinkSubject: 'Đăng nhập vào {appName}',
    magicLinkPreheader: 'Liên kết đăng nhập sẽ hết hạn sau vài phút.',
    magicLinkIntro:
      'Dùng nút bên dưới để đăng nhập vào {appName}. Liên kết hết hạn sau vài phút.',
    magicLinkFootnote: 'Vì lý do bảo mật, đừng chia sẻ liên kết này.',
    magicLinkCta: 'Đăng nhập',
    passwordResetSubject: 'Đặt lại mật khẩu {appName}',
    passwordResetPreheader: 'Tạo mật khẩu mới cho tài khoản của bạn.',
    passwordResetIntro:
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu {appName}. Dùng nút bên dưới.',
    passwordResetFootnote: 'Nếu bạn không yêu cầu, hãy bỏ qua email.',
    passwordResetCta: 'Đặt lại mật khẩu',
    verifyEmailSubject: 'Xác minh email cho {appName}',
    verifyEmailPreheader: 'Xác nhận email để hoàn tất tài khoản.',
    verifyEmailIntro: 'Vui lòng xác minh email để bắt đầu dùng {appName}.',
    verifyEmailFootnote: 'Nếu bạn không tạo tài khoản, hãy bỏ qua email.',
    verifyEmailCta: 'Xác minh email',
  },
  ja: {
    ignoreEmail: '心当たりがない場合は、このメールを無視してください。',
    magicLinkSubject: '{appName}にサインイン',
    magicLinkPreheader: 'サインインリンクは数分で期限切れになります。',
    magicLinkIntro:
      '下のボタンから{appName}にサインインしてください。リンクは数分で期限切れになります。',
    magicLinkFootnote: 'セキュリティのため、このリンクを共有しないでください。',
    magicLinkCta: 'サインイン',
    passwordResetSubject: '{appName}のパスワードをリセット',
    passwordResetPreheader: 'アカウントの新しいパスワードを設定してください。',
    passwordResetIntro:
      '{appName}のパスワードリセット要求を受け取りました。下のボタンをご利用ください。',
    passwordResetFootnote:
      '心当たりがない場合は、このメールを無視してください。',
    passwordResetCta: 'パスワードをリセット',
    verifyEmailSubject: '{appName}のメールアドレスを確認',
    verifyEmailPreheader:
      'アカウント設定を完了するにはメールを確認してください。',
    verifyEmailIntro:
      '{appName}を使い始めるにはメールアドレスを確認してください。',
    verifyEmailFootnote: 'アカウントを作成していない場合は無視してください。',
    verifyEmailCta: 'メールを確認',
  },
  ko: {
    ignoreEmail: '요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
    magicLinkSubject: '{appName}에 로그인',
    magicLinkPreheader: '로그인 링크는 몇 분 후 만료됩니다.',
    magicLinkIntro:
      '아래 버튼으로 {appName}에 로그인하세요. 링크는 몇 분 후 만료됩니다.',
    magicLinkFootnote: '보안을 위해 이 링크를 공유하지 마세요.',
    magicLinkCta: '로그인',
    passwordResetSubject: '{appName} 비밀번호 재설정',
    passwordResetPreheader: '계정의 새 비밀번호를 만드세요.',
    passwordResetIntro:
      '{appName} 비밀번호 재설정 요청을 받았습니다. 아래 버튼을 사용하세요.',
    passwordResetFootnote: '요청하지 않았다면 이 메일을 무시하세요.',
    passwordResetCta: '비밀번호 재설정',
    verifyEmailSubject: '{appName} 이메일 인증',
    verifyEmailPreheader: '계정 설정을 마치려면 이메일을 확인하세요.',
    verifyEmailIntro: '{appName}을(를) 사용하려면 이메일을 인증해 주세요.',
    verifyEmailFootnote: '계정을 만들지 않았다면 이 메일을 무시하세요.',
    verifyEmailCta: '이메일 인증',
  },
  zh: {
    ignoreEmail: '如果这不是您预期的邮件，可以忽略。',
    magicLinkSubject: '登录 {appName}',
    magicLinkPreheader: '登录链接将在几分钟后过期。',
    magicLinkIntro: '使用下方按钮登录 {appName}。链接将在几分钟后过期。',
    magicLinkFootnote: '为安全起见，请勿分享此链接。',
    magicLinkCta: '登录',
    passwordResetSubject: '重置 {appName} 密码',
    passwordResetPreheader: '为您的账户设置新密码。',
    passwordResetIntro: '我们收到了重置 {appName} 密码的请求。请使用下方按钮。',
    passwordResetFootnote: '如果这不是您发起的，可以忽略此邮件。',
    passwordResetCta: '重置密码',
    verifyEmailSubject: '验证 {appName} 邮箱',
    verifyEmailPreheader: '确认邮箱以完成账户设置。',
    verifyEmailIntro: '请验证邮箱以开始使用 {appName}。',
    verifyEmailFootnote: '如果未创建账户，可以忽略此邮件。',
    verifyEmailCta: '验证邮箱',
  },
  yue: {
    ignoreEmail: '如果唔係你預期嘅郵件，可以忽略。',
    magicLinkSubject: '登入 {appName}',
    magicLinkPreheader: '登入連結會喺幾分鐘後失效。',
    magicLinkIntro: '用下面嘅按鈕登入 {appName}。連結會喺幾分鐘後失效。',
    magicLinkFootnote: '為安全起见，唔好分享呢個連結。',
    magicLinkCta: '登入',
    passwordResetSubject: '重設 {appName} 密碼',
    passwordResetPreheader: '為你嘅帳戶設定新密碼。',
    passwordResetIntro: '我哋收到重設 {appName} 密碼嘅請求。請用下面嘅按鈕。',
    passwordResetFootnote: '如果唔係你發起，可以忽略呢封郵件。',
    passwordResetCta: '重設密碼',
    verifyEmailSubject: '驗證 {appName} 電郵',
    verifyEmailPreheader: '確認電郵以完成帳戶設定。',
    verifyEmailIntro: '請驗證電郵以開始使用 {appName}。',
    verifyEmailFootnote: '如果未建立帳戶，可以忽略呢封郵件。',
    verifyEmailCta: '驗證電郵',
  },
  ar: {
    ignoreEmail: 'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.',
    magicLinkSubject: 'تسجيل الدخول إلى {appName}',
    magicLinkPreheader: 'ينتهي رابط تسجيل الدخول خلال دقائق.',
    magicLinkIntro:
      'استخدم الزر أدناه لتسجيل الدخول إلى {appName}. ينتهي الرابط خلال دقائق.',
    magicLinkFootnote: 'لأسباب أمنية، لا تشارك هذا الرابط.',
    magicLinkCta: 'تسجيل الدخول',
    passwordResetSubject: 'إعادة تعيين كلمة مرور {appName}',
    passwordResetPreheader: 'أنشئ كلمة مرور جديدة لحسابك.',
    passwordResetIntro:
      'تلقّينا طلبًا لإعادة تعيين كلمة مرور {appName}. استخدم الزر أدناه.',
    passwordResetFootnote: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة.',
    passwordResetCta: 'إعادة تعيين كلمة المرور',
    verifyEmailSubject: 'تأكيد بريدك لـ {appName}',
    verifyEmailPreheader: 'أكّد بريدك الإلكتروني لإكمال الحساب.',
    verifyEmailIntro: 'يرجى تأكيد بريدك الإلكتروني لبدء استخدام {appName}.',
    verifyEmailFootnote: 'إذا لم تنشئ حسابًا، تجاهل هذه الرسالة.',
    verifyEmailCta: 'تأكيد البريد',
  },
}

function stringsFor(locale: InviteLocale): AuthCopy {
  return copy[locale] ?? copy.en
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

function buildAuthEmail(args: {
  locale: unknown
  appName: string
  url: string
  kind: 'magicLink' | 'passwordReset' | 'verifyEmail'
}) {
  const locale = normalizeInviteLocale(args.locale)
  const strings = stringsFor(locale)
  const appName = args.appName.trim() || 'logmaster'
  const vars = { appName }

  const fields =
    args.kind === 'magicLink'
      ? {
          subject: strings.magicLinkSubject,
          preheader: strings.magicLinkPreheader,
          intro: strings.magicLinkIntro,
          footnote: strings.magicLinkFootnote,
          cta: strings.magicLinkCta,
        }
      : args.kind === 'passwordReset'
        ? {
            subject: strings.passwordResetSubject,
            preheader: strings.passwordResetPreheader,
            intro: strings.passwordResetIntro,
            footnote: strings.passwordResetFootnote,
            cta: strings.passwordResetCta,
          }
        : {
            subject: strings.verifyEmailSubject,
            preheader: strings.verifyEmailPreheader,
            intro: strings.verifyEmailIntro,
            footnote: strings.verifyEmailFootnote,
            cta: strings.verifyEmailCta,
          }

  const subject = fill(fields.subject, vars)
  const introHtml = fill(fields.intro, { appName: escapeHtml(appName) })
  const text = `${fill(fields.intro, vars)}\n\n${args.url}\n\n${fill(fields.footnote, vars)}\n\n${strings.ignoreEmail}`
  const html = renderTransactionalEmail({
    locale,
    appName,
    preheader: fill(fields.preheader, vars),
    title: subject,
    introHtml,
    ctaLabel: fields.cta,
    ctaUrl: args.url,
    footnoteHtml: `${fill(fields.footnote, { appName: escapeHtml(appName) })} ${strings.ignoreEmail}`,
  })

  return { subject, text, html, locale }
}

export function buildMagicLinkEmail(args: {
  locale: unknown
  appName: string
  url: string
}) {
  return buildAuthEmail({ ...args, kind: 'magicLink' })
}

export function buildPasswordResetEmail(args: {
  locale: unknown
  appName: string
  url: string
}) {
  return buildAuthEmail({ ...args, kind: 'passwordReset' })
}

export function buildVerifyEmailEmail(args: {
  locale: unknown
  appName: string
  url: string
}) {
  return buildAuthEmail({ ...args, kind: 'verifyEmail' })
}
