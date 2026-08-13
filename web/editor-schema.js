/* ============================================================================
 *  editor-schema.js — describes the shape of the board content for editor.html
 *
 *  This is the single place that decides what the editor shows: which sections
 *  exist, what each field is called in Bulgarian, which lists can grow, and
 *  what a new row starts out as.
 *
 *  If you add a field to content.js and want it editable in the web editor,
 *  add it here too. Nothing else needs to change.
 * ========================================================================== */
window.BOARD_SCHEMA = {

  // Section order = tab order in the editor.
  sections: [

    /* ---------------------------------------------------------------- */
    {
      key: 'emergency',
      icon: 'phone',
      label: 'Спешни телефони',
      hint: 'Най-важната част от таблото. Показва се най-горе, с най-голям шрифт.',
      fields: [
        { key: 'bigNumber',  label: 'Голям номер',                  type: 'text', width: 'xs' },
        { key: 'bigLabelBg', label: 'Под номера (BG)',              type: 'text' },
        { key: 'bigLabelEn', label: 'Под номера (EN)',              type: 'text' },
        { key: 'externalTitleBg', label: 'Заглавие лява колона (BG)', type: 'text' },
        { key: 'externalTitleEn', label: 'Заглавие лява колона (EN)', type: 'text' },
      ],
      lists: [
        {
          key: 'external', label: 'Външни служби', max: 5,
          columns: [
            { key: 'tel', label: 'Телефон', width: 'sm' },
            { key: 'bg',  label: 'Служба (BG)' },
            { key: 'en',  label: 'Служба (EN)' },
          ],
          blank: { tel: '', bg: '', en: '' },
        },
        {
          key: 'internal', label: 'Вътрешни — при извънредна ситуация', max: 5,
          columns: [
            { key: 'tel', label: 'Телефон', width: 'sm' },
            { key: 'bg',  label: 'Име и длъжност (BG)' },
            { key: 'en',  label: 'Длъжност (EN)' },
          ],
          blank: { tel: '', bg: '', en: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'rules',
      icon: 'vest',
      label: 'Правила за шофьори',
      hint: 'Всяко правило е едно каре с икона. Отметката „важно“ го прави червено.',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
        { key: 'docRef',  label: 'Документ',      type: 'text', width: 'sm' },
        { key: 'docDate', label: 'Дата',          type: 'text', width: 'sm' },
        { key: 'warnBg',  label: 'Предупреждение долу (BG)', type: 'area' },
        { key: 'warnEn',  label: 'Предупреждение долу (EN)', type: 'area' },
      ],
      lists: [
        {
          key: 'items', label: 'Правила', max: 20,
          columns: [
            { key: 'icon',   label: 'Икона',  type: 'icon',  width: 'sm' },
            { key: 'bg',     label: 'Правило (BG)' },
            { key: 'en',     label: 'Правило (EN)' },
            { key: 'danger', label: 'Важно',  type: 'check', width: 'xs' },
          ],
          blank: { icon: 'doc', bg: '', en: '', danger: false },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'directory',
      icon: 'list',
      label: 'Служебни телефони',
      hint: 'Групирани по отдел. Добавете или премахнете хора и цели групи.',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
      ],
      groups: {
        key: 'groups', label: 'Отдели', max: 9,
        header: [
          { key: 'bg', label: 'Отдел (BG)' },
          { key: 'en', label: 'Отдел (EN)' },
        ],
        list: {
          key: 'people', label: 'Служители', max: 8,
          columns: [
            { key: 'name', label: 'Име' },
            { key: 'role', label: 'Длъжност' },
            { key: 'tel',  label: 'Телефон', width: 'sm' },
          ],
          blank: { name: '', role: '', tel: '' },
        },
        blank: { bg: '', en: '', people: [{ name: '', role: '', tel: '' }] },
      },
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'training',
      icon: 'calendar',
      label: 'Програма за обучение',
      hint: 'Дати във формат ДД.ММ — точно както в програмата.',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
        { key: 'docRef',  label: 'Документ',      type: 'text', width: 'sm' },
      ],
      lists: [
        {
          key: 'items', label: 'Обучения', max: 20,
          columns: [
            { key: 'date', label: 'Дата', width: 'xs' },
            { key: 'bg',   label: 'Тема', width: 'lg' },
            { key: 'who',  label: 'Отговорник' },
          ],
          blank: { date: '', bg: '', who: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'inspections',
      icon: 'check',
      label: 'Вътрешни инспекции',
      hint: 'Показват се в две колони. Това е най-дългият списък — следете предупреждението за побиране.',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
        { key: 'docRef',  label: 'Документ',      type: 'text', width: 'sm' },
        { key: 'noteBg',  label: 'Забележка долу (BG)', type: 'area' },
        { key: 'noteEn',  label: 'Забележка долу (EN)', type: 'area' },
      ],
      lists: [
        {
          key: 'items', label: 'Инспекции', max: 30,
          columns: [
            { key: 'date', label: 'Дата', width: 'xs' },
            { key: 'bg',   label: 'Обект на инспекция' },
          ],
          blank: { date: '', bg: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'cleaning',
      icon: 'clean',
      label: 'Почистване и дезинфекция',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
        { key: 'docRef',  label: 'Документ',      type: 'text', width: 'sm' },
        { key: 'validBg', label: 'Валидност',     type: 'text' },
      ],
      lists: [
        {
          key: 'items', label: 'Зони', max: 18,
          columns: [
            { key: 'zone', label: 'Зона / помещение', width: 'lg' },
            { key: 'who',  label: 'Извършва се от' },
            { key: 'freq', label: 'Честота', width: 'md' },
          ],
          blank: { zone: '', who: '', freq: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'waste',
      icon: 'waste',
      label: 'Отпадъци',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
        { key: 'docRef',  label: 'Документ',      type: 'text', width: 'sm' },
        { key: 'docDate', label: 'Дата',          type: 'text', width: 'sm' },
        { key: 'legal',   label: 'Правно основание', type: 'text' },
      ],
      lists: [
        {
          key: 'prohibited', label: 'Забранено', max: 5,
          columns: [{ key: 'bg', label: 'Текст (BG)' }, { key: 'en', label: 'Текст (EN)' }],
          blank: { bg: '', en: '' },
        },
        {
          key: 'required', label: 'Задължително', max: 5,
          columns: [{ key: 'bg', label: 'Текст (BG)' }, { key: 'en', label: 'Текст (EN)' }],
          blank: { bg: '', en: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'committee',
      icon: 'people',
      label: 'Комитет по условия на труд',
      fields: [
        { key: 'titleBg',    label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn',    label: 'Заглавие (EN)', type: 'text' },
        { key: 'employerBg', label: 'Лява страна (BG)', type: 'text' },
        { key: 'employerEn', label: 'Лява страна (EN)', type: 'text' },
        { key: 'workersBg',  label: 'Дясна страна (BG)', type: 'text' },
        { key: 'workersEn',  label: 'Дясна страна (EN)', type: 'text' },
      ],
      lists: [
        {
          key: 'employer', label: 'От страна на работодателя', max: 5,
          columns: [{ key: 'name', label: 'Име' }, { key: 'role', label: 'Длъжност' }],
          blank: { name: '', role: '' },
        },
        {
          key: 'workers', label: 'От страна на работниците', max: 5,
          columns: [{ key: 'name', label: 'Име' }, { key: 'role', label: 'Длъжност' }],
          blank: { name: '', role: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'fireSafety',
      icon: 'fire',
      label: 'Сертификати пожарна безопасност',
      hint: 'Показват се в пет колони, номерирани. Пасват удобно до 20 души.',
      fields: [
        { key: 'titleBg', label: 'Заглавие (BG)', type: 'text' },
        { key: 'titleEn', label: 'Заглавие (EN)', type: 'text' },
      ],
      lists: [
        {
          key: 'people', label: 'Служители със сертификат', max: 20,
          columns: [{ key: 'name', label: 'Име' }, { key: 'role', label: 'Отдел / длъжност' }],
          blank: { name: '', role: '' },
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'header',
      icon: 'doc',
      label: 'Заглавие на таблото',
      fields: [
        { key: 'title',    label: 'Заглавие (BG)', type: 'text' },
        { key: 'subtitle', label: 'Подзаглавие (EN)', type: 'text' },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      key: 'kiosk',
      icon: 'kiosk',
      label: 'Долна лента — тъч-киоск',
      hint: 'Тук се посочва къде хората могат да видят подписаните оригинали.',
      fields: [
        { key: 'mainBg', label: 'Основен текст (BG)', type: 'area' },
        { key: 'mainEn', label: 'Основен текст (EN)', type: 'area' },
        { key: 'hintBg', label: 'Малък текст вдясно (BG)', type: 'text' },
        { key: 'hintEn', label: 'Малък текст вдясно (EN)', type: 'text' },
      ],
    },
  ],

  // Every pictogram available in the sprite, with a Bulgarian name so the
  // person editing picks "предпазни обувки" rather than remembering "boot".
  icons: [
    ['vest', 'Жилетка'], ['boot', 'Обувки'], ['speed', 'Скорост'], ['engine', 'Двигател'],
    ['chock', 'Клинове'], ['strap', 'Обезопасен товар'], ['nosmoke', 'Не се пуши'],
    ['noeat', 'Не се храни'], ['noentry', 'Без достъп'], ['cabin', 'Кабина'],
    ['doc', 'Документи'], ['stamp', 'Подпис и печат'], ['toilet', 'Тоалетна'],
    ['parking', 'Паркиране'], ['noalcohol', 'Без алкохол'], ['alert', 'Внимание'],
    ['cctv', 'Видеонаблюдение'], ['mask', 'Маска'], ['waste', 'Отпадъци'],
    ['kiosk', 'Киоск'], ['phone', 'Телефон'], ['list', 'Списък'], ['people', 'Хора'],
    ['fire', 'Пожарна безопасност'], ['clean', 'Почистване'], ['check', 'Проверка'],
    ['calendar', 'Календар'],
  ],
};
