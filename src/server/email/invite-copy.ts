import type { InviteLocale } from '../../lib/invite-locale'
import { normalizeInviteLocale } from '../../lib/invite-locale'
import { escapeHtml, renderTransactionalEmail } from './html'

type InviteCopy = {
  someone: string
  orgFallback: string
  boatFallback: string
  ctaAccept: string
  ignoreEmail: string
  crewSubject: string
  crewPreheader: string
  crewIntroSuffix: string
  crewFootnote: string
  memberSubject: string
  memberPreheader: string
  memberIntroSuffix: string
  memberFootnote: string
}

const copy: Record<InviteLocale, InviteCopy> = {
  en: {
    someone: 'Someone',
    orgFallback: 'an organization',
    boatFallback: 'a boat',
    ctaAccept: 'Accept invite',
    ignoreEmail: 'If you were not expecting this, you can ignore this email.',
    crewSubject: '{inviter} invited you to join their crew on {appName}',
    crewPreheader: 'Connect your account to join their crew.',
    crewIntroSuffix:
      'invited you to join their crew on {appName}. Sign in with this email address, then accept the invite to connect your account.',
    crewFootnote:
      'The link opens {appName}. If you do not have an account yet, sign in with this email to create one.',
    memberSubject: '{inviter} invited you to {target} on {appName}',
    memberPreheader: 'Join {target} on {appName}.',
    memberIntroSuffix:
      'invited you to join {target} on {appName}. Sign in with this email address, then accept the invite.',
    memberFootnote:
      'The link opens {appName}. If you do not have an account yet, sign in with this email to create one.',
  },
  sv: {
    someone: 'Någon',
    orgFallback: 'en organisation',
    boatFallback: 'en båt',
    ctaAccept: 'Acceptera inbjudan',
    ignoreEmail: 'Om du inte väntade det här kan du ignorera mejlet.',
    crewSubject: '{inviter} bjöd in dig till sitt crew på {appName}',
    crewPreheader: 'Koppla ditt konto för att gå med i crewet.',
    crewIntroSuffix:
      'bjöd in dig till sitt crew på {appName}. Logga in med den här e-postadressen och acceptera inbjudan för att koppla ditt konto.',
    crewFootnote:
      'Länken öppnar {appName}. Om du inte har ett konto än loggar du in med den här e-postadressen för att skapa ett.',
    memberSubject: '{inviter} bjöd in dig till {target} på {appName}',
    memberPreheader: 'Gå med i {target} på {appName}.',
    memberIntroSuffix:
      'bjöd in dig till {target} på {appName}. Logga in med den här e-postadressen och acceptera inbjudan.',
    memberFootnote:
      'Länken öppnar {appName}. Om du inte har ett konto än loggar du in med den här e-postadressen för att skapa ett.',
  },
  da: {
    someone: 'Nogen',
    orgFallback: 'en organisation',
    boatFallback: 'en båd',
    ctaAccept: 'Acceptér invitation',
    ignoreEmail: 'Hvis du ikke forventede dette, kan du ignorere e-mailen.',
    crewSubject: '{inviter} inviterede dig til deres crew på {appName}',
    crewPreheader: 'Forbind din konto for at blive en del af crewet.',
    crewIntroSuffix:
      'inviterede dig til deres crew på {appName}. Log ind med denne e-mail og acceptér invitationen for at forbinde din konto.',
    crewFootnote:
      'Linket åbner {appName}. Hvis du ikke har en konto endnu, kan du logge ind med denne e-mail for at oprette en.',
    memberSubject: '{inviter} inviterede dig til {target} på {appName}',
    memberPreheader: 'Bliv en del af {target} på {appName}.',
    memberIntroSuffix:
      'inviterede dig til {target} på {appName}. Log ind med denne e-mail og acceptér invitationen.',
    memberFootnote:
      'Linket åbner {appName}. Hvis du ikke har en konto endnu, kan du logge ind med denne e-mail for at oprette en.',
  },
  de: {
    someone: 'Jemand',
    orgFallback: 'eine Organisation',
    boatFallback: 'ein Boot',
    ctaAccept: 'Einladung annehmen',
    ignoreEmail:
      'Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.',
    crewSubject: '{inviter} hat dich zum Crew auf {appName} eingeladen',
    crewPreheader: 'Verbinde dein Konto, um der Crew beizutreten.',
    crewIntroSuffix:
      'hat dich eingeladen, der Crew auf {appName} beizutreten. Melde dich mit dieser E-Mail-Adresse an und nimm die Einladung an.',
    crewFootnote:
      'Der Link öffnet {appName}. Wenn du noch kein Konto hast, melde dich mit dieser E-Mail an, um eines zu erstellen.',
    memberSubject: '{inviter} hat dich zu {target} auf {appName} eingeladen',
    memberPreheader: 'Tritt {target} auf {appName} bei.',
    memberIntroSuffix:
      'hat dich eingeladen, {target} auf {appName} beizutreten. Melde dich mit dieser E-Mail-Adresse an und nimm die Einladung an.',
    memberFootnote:
      'Der Link öffnet {appName}. Wenn du noch kein Konto hast, melde dich mit dieser E-Mail an, um eines zu erstellen.',
  },
  es: {
    someone: 'Alguien',
    orgFallback: 'una organización',
    boatFallback: 'un barco',
    ctaAccept: 'Aceptar invitación',
    ignoreEmail: 'Si no esperabas este correo, puedes ignorarlo.',
    crewSubject: '{inviter} te invitó a su tripulación en {appName}',
    crewPreheader: 'Conecta tu cuenta para unirte a la tripulación.',
    crewIntroSuffix:
      'te invitó a unirte a su tripulación en {appName}. Inicia sesión con este correo y acepta la invitación para conectar tu cuenta.',
    crewFootnote:
      'El enlace abre {appName}. Si aún no tienes cuenta, inicia sesión con este correo para crear una.',
    memberSubject: '{inviter} te invitó a {target} en {appName}',
    memberPreheader: 'Únete a {target} en {appName}.',
    memberIntroSuffix:
      'te invitó a unirte a {target} en {appName}. Inicia sesión con este correo y acepta la invitación.',
    memberFootnote:
      'El enlace abre {appName}. Si aún no tienes cuenta, inicia sesión con este correo para crear una.',
  },
  fr: {
    someone: 'Quelqu’un',
    orgFallback: 'une organisation',
    boatFallback: 'un bateau',
    ctaAccept: 'Accepter l’invitation',
    ignoreEmail: 'Si vous n’attendiez pas cet e-mail, vous pouvez l’ignorer.',
    crewSubject: '{inviter} vous a invité dans son équipage sur {appName}',
    crewPreheader: 'Connectez votre compte pour rejoindre l’équipage.',
    crewIntroSuffix:
      'vous a invité à rejoindre son équipage sur {appName}. Connectez-vous avec cette adresse e-mail, puis acceptez l’invitation.',
    crewFootnote:
      'Le lien ouvre {appName}. Si vous n’avez pas encore de compte, connectez-vous avec cet e-mail pour en créer un.',
    memberSubject: '{inviter} vous a invité sur {target} dans {appName}',
    memberPreheader: 'Rejoignez {target} sur {appName}.',
    memberIntroSuffix:
      'vous a invité à rejoindre {target} sur {appName}. Connectez-vous avec cette adresse e-mail, puis acceptez l’invitation.',
    memberFootnote:
      'Le lien ouvre {appName}. Si vous n’avez pas encore de compte, connectez-vous avec cet e-mail pour en créer un.',
  },
  nl: {
    someone: 'Iemand',
    orgFallback: 'een organisatie',
    boatFallback: 'een boot',
    ctaAccept: 'Uitnodiging accepteren',
    ignoreEmail: 'Als je deze e-mail niet verwachtte, kun je hem negeren.',
    crewSubject: '{inviter} nodigde je uit voor hun crew op {appName}',
    crewPreheader: 'Koppel je account om bij de crew te horen.',
    crewIntroSuffix:
      'nodigde je uit voor hun crew op {appName}. Log in met dit e-mailadres en accepteer de uitnodiging om je account te koppelen.',
    crewFootnote:
      'De link opent {appName}. Als je nog geen account hebt, log je in met dit e-mailadres om er een te maken.',
    memberSubject: '{inviter} nodigde je uit voor {target} op {appName}',
    memberPreheader: 'Word lid van {target} op {appName}.',
    memberIntroSuffix:
      'nodigde je uit voor {target} op {appName}. Log in met dit e-mailadres en accepteer de uitnodiging.',
    memberFootnote:
      'De link opent {appName}. Als je nog geen account hebt, log je in met dit e-mailadres om er een te maken.',
  },
  pt: {
    someone: 'Alguém',
    orgFallback: 'uma organização',
    boatFallback: 'um barco',
    ctaAccept: 'Aceitar convite',
    ignoreEmail: 'Se não estava à espera deste e-mail, pode ignorá-lo.',
    crewSubject: '{inviter} convidou-o para a tripulação em {appName}',
    crewPreheader: 'Ligue a sua conta para se juntar à tripulação.',
    crewIntroSuffix:
      'convidou-o para a tripulação em {appName}. Inicie sessão com este e-mail e aceite o convite para ligar a sua conta.',
    crewFootnote:
      'A ligação abre {appName}. Se ainda não tem conta, inicie sessão com este e-mail para criar uma.',
    memberSubject: '{inviter} convidou-o para {target} em {appName}',
    memberPreheader: 'Junte-se a {target} em {appName}.',
    memberIntroSuffix:
      'convidou-o para {target} em {appName}. Inicie sessão com este e-mail e aceite o convite.',
    memberFootnote:
      'A ligação abre {appName}. Se ainda não tem conta, inicie sessão com este e-mail para criar uma.',
  },
  fi: {
    someone: 'Joku',
    orgFallback: 'organisaatio',
    boatFallback: 'vene',
    ctaAccept: 'Hyväksy kutsu',
    ignoreEmail: 'Jos et odottanut tätä viestiä, voit jättää sen huomiotta.',
    crewSubject: '{inviter} kutsui sinut miehistöönsä palvelussa {appName}',
    crewPreheader: 'Yhdistä tilisi liittyäksesi miehistöön.',
    crewIntroSuffix:
      'kutsui sinut miehistöönsä palvelussa {appName}. Kirjaudu sisään tällä sähköpostilla ja hyväksy kutsu yhdistääksesi tilisi.',
    crewFootnote:
      'Linkki avaa palvelun {appName}. Jos sinulla ei vielä ole tiliä, kirjaudu sisään tällä sähköpostilla luodaksesi sellaisen.',
    memberSubject: '{inviter} kutsui sinut kohteeseen {target} palvelussa {appName}',
    memberPreheader: 'Liity kohteeseen {target} palvelussa {appName}.',
    memberIntroSuffix:
      'kutsui sinut kohteeseen {target} palvelussa {appName}. Kirjaudu sisään tällä sähköpostilla ja hyväksy kutsu.',
    memberFootnote:
      'Linkki avaa palvelun {appName}. Jos sinulla ei vielä ole tiliä, kirjaudu sisään tällä sähköpostilla luodaksesi sellaisen.',
  },
  el: {
    someone: 'Κάποιος',
    orgFallback: 'μια οργάνωση',
    boatFallback: 'ένα σκάφος',
    ctaAccept: 'Αποδοχή πρόσκλησης',
    ignoreEmail: 'Αν δεν περιμένατε αυτό το email, μπορείτε να το αγνοήσετε.',
    crewSubject: 'Ο/Η {inviter} σας προσκάλεσε στο πλήρωμά του/της στο {appName}',
    crewPreheader: 'Συνδέστε τον λογαριασμό σας για να ενταχθείτε στο πλήρωμα.',
    crewIntroSuffix:
      'σας προσκάλεσε να ενταχθείτε στο πλήρωμά του/της στο {appName}. Συνδεθείτε με αυτό το email και αποδεχτείτε την πρόσκληση.',
    crewFootnote:
      'Ο σύνδεσμος ανοίγει το {appName}. Αν δεν έχετε ακόμη λογαριασμό, συνδεθείτε με αυτό το email για να δημιουργήσετε έναν.',
    memberSubject: 'Ο/Η {inviter} σας προσκάλεσε στο {target} στο {appName}',
    memberPreheader: 'Ενταχθείτε στο {target} στο {appName}.',
    memberIntroSuffix:
      'σας προσκάλεσε να ενταχθείτε στο {target} στο {appName}. Συνδεθείτε με αυτό το email και αποδεχτείτε την πρόσκληση.',
    memberFootnote:
      'Ο σύνδεσμος ανοίγει το {appName}. Αν δεν έχετε ακόμη λογαριασμό, συνδεθείτε με αυτό το email για να δημιουργήσετε έναν.',
  },
  tr: {
    someone: 'Birisi',
    orgFallback: 'bir organizasyon',
    boatFallback: 'bir tekne',
    ctaAccept: 'Daveti kabul et',
    ignoreEmail: 'Bu e-postayı beklemiyorsanız yok sayabilirsiniz.',
    crewSubject: '{inviter} sizi {appName} ekibine davet etti',
    crewPreheader: 'Ekibe katılmak için hesabınızı bağlayın.',
    crewIntroSuffix:
      'sizi {appName} ekibine davet etti. Bu e-posta ile giriş yapın ve hesabınızı bağlamak için daveti kabul edin.',
    crewFootnote:
      'Bağlantı {appName} uygulamasını açar. Henüz hesabınız yoksa, bu e-posta ile giriş yaparak oluşturabilirsiniz.',
    memberSubject: '{inviter} sizi {appName} üzerinde {target} hedefine davet etti',
    memberPreheader: '{appName} üzerinde {target} hedefine katılın.',
    memberIntroSuffix:
      'sizi {appName} üzerinde {target} hedefine davet etti. Bu e-posta ile giriş yapın ve daveti kabul edin.',
    memberFootnote:
      'Bağlantı {appName} uygulamasını açar. Henüz hesabınız yoksa, bu e-posta ile giriş yaparak oluşturabilirsiniz.',
  },
  vi: {
    someone: 'Ai đó',
    orgFallback: 'một tổ chức',
    boatFallback: 'một thuyền',
    ctaAccept: 'Chấp nhận lời mời',
    ignoreEmail: 'Nếu bạn không mong đợi email này, hãy bỏ qua.',
    crewSubject: '{inviter} mời bạn tham gia thuyền đội trên {appName}',
    crewPreheader: 'Liên kết tài khoản để tham gia thuyền đội.',
    crewIntroSuffix:
      'mời bạn tham gia thuyền đội trên {appName}. Đăng nhập bằng email này rồi chấp nhận lời mời để liên kết tài khoản.',
    crewFootnote:
      'Liên kết mở {appName}. Nếu bạn chưa có tài khoản, hãy đăng nhập bằng email này để tạo một tài khoản.',
    memberSubject: '{inviter} mời bạn tham gia {target} trên {appName}',
    memberPreheader: 'Tham gia {target} trên {appName}.',
    memberIntroSuffix:
      'mời bạn tham gia {target} trên {appName}. Đăng nhập bằng email này rồi chấp nhận lời mời.',
    memberFootnote:
      'Liên kết mở {appName}. Nếu bạn chưa có tài khoản, hãy đăng nhập bằng email này để tạo một tài khoản.',
  },
  ja: {
    someone: '誰か',
    orgFallback: '組織',
    boatFallback: 'ボート',
    ctaAccept: '招待を承認',
    ignoreEmail: '心当たりがない場合は、このメールを無視してください。',
    crewSubject: '{inviter}さんが{appName}のクルーに招待しました',
    crewPreheader: 'アカウントを連携してクルーに参加しましょう。',
    crewIntroSuffix:
      'さんが{appName}のクルーへの参加を招待しました。このメールアドレスでサインインし、招待を承認してアカウントを連携してください。',
    crewFootnote:
      'リンクは{appName}を開きます。アカウントがない場合は、このメールアドレスでサインインして作成できます。',
    memberSubject: '{inviter}さんが{appName}の{target}に招待しました',
    memberPreheader: '{appName}の{target}に参加しましょう。',
    memberIntroSuffix:
      'さんが{appName}の{target}への参加を招待しました。このメールアドレスでサインインし、招待を承認してください。',
    memberFootnote:
      'リンクは{appName}を開きます。アカウントがない場合は、このメールアドレスでサインインして作成できます。',
  },
  ko: {
    someone: '누군가',
    orgFallback: '조직',
    boatFallback: '보트',
    ctaAccept: '초대 수락',
    ignoreEmail: '예상하지 못한 메일이라면 무시하셔도 됩니다.',
    crewSubject: '{inviter}님이 {appName} 크루에 초대했습니다',
    crewPreheader: '계정을 연결해 크루에 참여하세요.',
    crewIntroSuffix:
      '님이 {appName} 크루 참여를 초대했습니다. 이 이메일로 로그인한 뒤 초대를 수락해 계정을 연결하세요.',
    crewFootnote:
      '링크는 {appName}을 엽니다. 계정이 없다면 이 이메일로 로그인해 만들 수 있습니다.',
    memberSubject: '{inviter}님이 {appName}의 {target}에 초대했습니다',
    memberPreheader: '{appName}의 {target}에 참여하세요.',
    memberIntroSuffix:
      '님이 {appName}의 {target} 참여를 초대했습니다. 이 이메일로 로그인한 뒤 초대를 수락하세요.',
    memberFootnote:
      '링크는 {appName}을 엽니다. 계정이 없다면 이 이메일로 로그인해 만들 수 있습니다.',
  },
  zh: {
    someone: '某人',
    orgFallback: '一个组织',
    boatFallback: '一艘船',
    ctaAccept: '接受邀请',
    ignoreEmail: '如果这不是您预期的邮件，可以忽略。',
    crewSubject: '{inviter} 邀请您加入 {appName} 的船员',
    crewPreheader: '连接账户以加入船员。',
    crewIntroSuffix:
      '邀请您加入 {appName} 的船员。请使用此邮箱登录并接受邀请以连接账户。',
    crewFootnote:
      '链接将打开 {appName}。如果还没有账户，请使用此邮箱登录创建。',
    memberSubject: '{inviter} 邀请您加入 {appName} 的 {target}',
    memberPreheader: '加入 {appName} 的 {target}。',
    memberIntroSuffix:
      '邀请您加入 {appName} 的 {target}。请使用此邮箱登录并接受邀请。',
    memberFootnote:
      '链接将打开 {appName}。如果还没有账户，请使用此邮箱登录创建。',
  },
  yue: {
    someone: '某人',
    orgFallback: '一個組織',
    boatFallback: '一艘船',
    ctaAccept: '接受邀請',
    ignoreEmail: '如果唔係你預期嘅郵件，可以忽略。',
    crewSubject: '{inviter} 邀請你加入 {appName} 嘅船員',
    crewPreheader: '連接帳戶以加入船員。',
    crewIntroSuffix:
      '邀請你加入 {appName} 嘅船員。請用呢個電郵登入並接受邀請以連接帳戶。',
    crewFootnote:
      '連結會開啟 {appName}。如果未有帳戶，可以用呢個電郵登入建立。',
    memberSubject: '{inviter} 邀請你加入 {appName} 嘅 {target}',
    memberPreheader: '加入 {appName} 嘅 {target}。',
    memberIntroSuffix:
      '邀請你加入 {appName} 嘅 {target}。請用呢個電郵登入並接受邀請。',
    memberFootnote:
      '連結會開啟 {appName}。如果未有帳戶，可以用呢個電郵登入建立。',
  },
  ar: {
    someone: 'شخص ما',
    orgFallback: 'منظمة',
    boatFallback: 'قارب',
    ctaAccept: 'قبول الدعوة',
    ignoreEmail: 'إذا لم تكن تتوقع هذه الرسالة، يمكنك تجاهلها.',
    crewSubject: '{inviter} دعاك للانضمام إلى طاقمه على {appName}',
    crewPreheader: 'اربط حسابك للانضمام إلى الطاقم.',
    crewIntroSuffix:
      'دعاك للانضمام إلى طاقمه على {appName}. سجّل الدخول باستخدام هذا البريد ثم اقبل الدعوة لربط حسابك.',
    crewFootnote:
      'يفتح الرابط {appName}. إذا لم يكن لديك حساب بعد، سجّل الدخول بهذا البريد لإنشاء حساب.',
    memberSubject: '{inviter} دعاك إلى {target} على {appName}',
    memberPreheader: 'انضم إلى {target} على {appName}.',
    memberIntroSuffix:
      'دعاك للانضمام إلى {target} على {appName}. سجّل الدخول باستخدام هذا البريد ثم اقبل الدعوة.',
    memberFootnote:
      'يفتح الرابط {appName}. إذا لم يكن لديك حساب بعد، سجّل الدخول بهذا البريد لإنشاء حساب.',
  },
}

function stringsFor(locale: InviteLocale): InviteCopy {
  return copy[locale] ?? copy.en
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

function inviterLabel(raw: string, strings: InviteCopy): string {
  const trimmed = raw.trim()
  return escapeHtml(trimmed || strings.someone)
}

export function resolveMemberTargetName(args: {
  locale: InviteLocale
  targetName: string | null | undefined
  targetKind: 'org' | 'boat'
}): string {
  const strings = stringsFor(args.locale)
  const trimmed = args.targetName?.trim()
  if (trimmed) return trimmed
  return args.targetKind === 'org' ? strings.orgFallback : strings.boatFallback
}

export function buildCrewInviteEmail(args: {
  locale: unknown
  appName: string
  inviterName: string
  url: string
}) {
  const locale = normalizeInviteLocale(args.locale)
  const strings = stringsFor(locale)
  const appName = args.appName.trim() || 'logmaster'
  const inviter = inviterLabel(args.inviterName, strings)
  const vars = {
    inviter: inviter.replace(/<\/?[^>]+>/g, ''),
    appName,
    target: '',
  }
  const subject = fill(strings.crewSubject, {
    inviter: vars.inviter,
    appName,
    target: '',
  })
  const introHtml = `<strong>${inviter}</strong> ${fill(strings.crewIntroSuffix, {
    appName: escapeHtml(appName),
    target: '',
    inviter: '',
  })}`
  const text = `${vars.inviter} ${fill(strings.crewIntroSuffix, { appName, target: '', inviter: '' })}\n\n${args.url}\n\n${strings.crewFootnote.replace('{appName}', appName)}\n\n${strings.ignoreEmail}`
  const html = renderTransactionalEmail({
    locale,
    appName,
    preheader: fill(strings.crewPreheader, { appName, inviter: vars.inviter, target: '' }),
    title: subject,
    introHtml,
    ctaLabel: strings.ctaAccept,
    ctaUrl: args.url,
    footnoteHtml: `${fill(strings.crewFootnote, { appName: escapeHtml(appName), inviter: '', target: '' })} ${strings.ignoreEmail}`,
  })
  return { subject, text, html, locale }
}

export function buildMemberInviteEmail(args: {
  locale: unknown
  appName: string
  inviterName: string
  targetName: string | null | undefined
  targetKind: 'org' | 'boat'
  url: string
}) {
  const locale = normalizeInviteLocale(args.locale)
  const strings = stringsFor(locale)
  const appName = args.appName.trim() || 'logmaster'
  const inviter = inviterLabel(args.inviterName, strings)
  const target = escapeHtml(
    resolveMemberTargetName({
      locale,
      targetName: args.targetName,
      targetKind: args.targetKind,
    }),
  )
  const targetPlain = target.replace(/<\/?[^>]+>/g, '')
  const subject = fill(strings.memberSubject, {
    inviter: inviter.replace(/<\/?[^>]+>/g, ''),
    appName,
    target: targetPlain,
  })
  const introHtml = `<strong>${inviter}</strong> ${fill(strings.memberIntroSuffix, {
    appName: escapeHtml(appName),
    target,
    inviter: '',
  })}`
  const text = `${inviter.replace(/<\/?[^>]+>/g, '')} ${fill(strings.memberIntroSuffix, { appName, target: targetPlain, inviter: '' })}\n\n${args.url}\n\n${fill(strings.memberFootnote, { appName, inviter: '', target: targetPlain })}\n\n${strings.ignoreEmail}`
  const html = renderTransactionalEmail({
    locale,
    appName,
    preheader: fill(strings.memberPreheader, {
      appName,
      inviter: inviter.replace(/<\/?[^>]+>/g, ''),
      target: targetPlain,
    }),
    title: subject,
    introHtml,
    ctaLabel: strings.ctaAccept,
    ctaUrl: args.url,
    footnoteHtml: `${fill(strings.memberFootnote, { appName: escapeHtml(appName), inviter: '', target })} ${strings.ignoreEmail}`,
  })
  return { subject, text, html, locale }
}
