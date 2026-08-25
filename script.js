/* ==========================================================================
   Currículo dinâmico — carregado via AJAX a partir de resume.json
   Renderiza cabeçalho, subcabeçalho (contato com ícones) e seções como
   painéis colapsáveis independentes (todos abertos por padrão).
   ========================================================================== */
(function ($) {
  "use strict";

  var LANG = "pt-BR"; // idioma padrão definido em data.language.default
  var RESUME_DATA = null; // dados carregados via AJAX, mantidos para re-render ao trocar idioma
  var openState = {}; // preserva quais painéis estão abertos/fechados entre re-renders

  var LANG_NAMES = {
    "pt-BR": "PT",
    "en-US": "EN"
  };

  var PAGE_TITLE = {
    "pt-BR": "Currículo Profissional",
    "en-US": "Profissional Profile"
  };

  var PRINT_LABEL = {
    "pt-BR": "Imprimir",
    "en-US": "Print"
  };

  // IDs de contato que devem iniciar uma nova linha no subcabeçalho.
  var BREAK_BEFORE_IDS = { email: true };

  // IDs que devem se juntar ao <li> do item anterior em vez de abrir uma
  // nova linha — é isso que mantém telefone e whatsapp ao lado do e-mail,
  // mesmo com o e-mail iniciando uma nova linha (BREAK_BEFORE_IDS acima).
  var SAME_LINE_AS_PREVIOUS_IDS = { phone: true, whatsapp: true };

  /** Retorna o texto localizado de um objeto {pt-BR, en-US} com fallback. */
  function t(field) {
    if (field == null) return "";
    if (typeof field === "string") return field;
    return field[LANG] || field["pt-BR"] || field["en-US"] || "";
  }

  /** Calcula idade a partir de uma data ISO (YYYY-MM-DD). */
  function calcAge(isoDate) {
    if (!isoDate) return null;
    var birth = new Date(isoDate + "T00:00:00");
    var today = new Date();
    var age = today.getFullYear() - birth.getFullYear();
    var m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  /** Escapa texto para uso seguro em HTML. */
  function esc(str) {
    return $("<div>").text(str == null ? "" : str).html();
  }

  /* ---------------------------------------------------------------------
     Seletor de idioma (construído a partir de data.language.available)
  --------------------------------------------------------------------- */
  function renderLangSwitch($root, data) {
    var $group = $root.find(".lang-switch").empty();
    var available = (data.language && data.language.available) || [LANG];

    $.each(available, function (_, code) {
      var $btn = $("<button>", {
        type: "button",
        class: "lang-switch__btn",
        "data-lang": code,
        "aria-pressed": String(code === LANG),
        text: LANG_NAMES[code] || code
      });
      $group.append($btn);
    });

    $group.off("click").on("click", ".lang-switch__btn", function () {
      var newLang = $(this).data("lang");
      if (newLang === LANG) return;
      LANG = newLang;
      renderAll();
    });
  }

  /* ---------------------------------------------------------------------
     Botão de impressão / salvar em PDF
  --------------------------------------------------------------------- */
  function renderPrintButton($root) {
    var $btn = $root.find(".print-btn");
    $btn.text(PRINT_LABEL[LANG] || PRINT_LABEL["pt-BR"]);
    $btn.off("click").on("click", function () {
      window.print();
    });
  }

  /* ---------------------------------------------------------------------
     Renderização do cabeçalho + subcabeçalho de contato
  --------------------------------------------------------------------- */
  function renderHeader($root, data) {
    $root.find(".header__eyebrow").text(t(data.header.title));
    $root.find(".header__name").text(data.header.fullName);
    $root.find(".header__role").text(t(data.header.targetPosition));

    var $list = $root.find(".subheader__list");
    var $currentLine = null; // <li> da linha em construção, para agrupar itens

    $.each(data.contactInfo, function (_, item) {
      var $wrap = buildContactItem(item);

      // Telefone e whatsapp entram no <li> já aberto pelo e-mail, em vez
      // de criar uma nova linha — assim os três ficam juntos, na mesma linha.
      if (SAME_LINE_AS_PREVIOUS_IDS[item.id] && $currentLine) {
        $currentLine.append($wrap);
        return;
      }

      var $li = $("<li>");
      if (BREAK_BEFORE_IDS[item.id]) {
        $li.addClass("subheader__break-before");
      }
      $li.append($wrap);
      $list.append($li);
      $currentLine = $li;
    });
  }

  /** Constrói o ícone + valor (e link, quando houver) de um item de contato. */
  function buildContactItem(item) {
    var value = t(item.value);
    var label = t(item.label);
    var $inner = $("<span>", { class: "subheader__icon", "aria-hidden": "true" }).html(item.icon || "");

    var $text = $("<span>", { class: "subheader__value" }).text(value);

    // Data de nascimento: acrescenta a idade calculada ao lado do valor
    if (item.id === "birthDate" && item.isoDate) {
      var age = calcAge(item.isoDate);
      if (age !== null) {
        var ageLabel = LANG === "pt-BR" ? " (" + age + " anos)" : " (age " + age + ")";
        $text.append($("<span>", { class: "subheader__age" }).text(ageLabel));
      }
    }

    // O ícone e o dado ficam dentro do mesmo link, apontando para o
    // href definido no JSON (quando existir).
    var $wrap;
    if (item.href) {
      $wrap = $("<a>", {
        class: "subheader__item",
        href: item.href,
        title: label
      });
      if (item.external) {
        $wrap.attr("target", "_blank").attr("rel", "noopener noreferrer");
      }
    } else {
      $wrap = $("<span>", { class: "subheader__item", title: label });
    }

    $wrap.append($inner, $text);
    return $wrap;
  }

  /* ---------------------------------------------------------------------
     Helpers de construção de painel (collapsible panel)
  --------------------------------------------------------------------- */
  var panelIndex = 0;

  function makePanel(key, title) {
    panelIndex++;
    var $panel = $($("#tpl-panel").html().trim());
    // Preserva o estado aberto/fechado do painel entre trocas de idioma
    var isOpen = openState.hasOwnProperty(key) ? openState[key] : true;
    $panel.attr("data-open", String(isOpen));
    $panel.attr("data-key", key);
    $panel.find(".panel__header").attr("aria-expanded", String(isOpen));
    $panel.find(".panel__index").text(String(panelIndex).padStart(2, "0"));
    $panel.find(".panel__title").text(title);
    return $panel;
  }

  /* ---------------------------------------------------------------------
     Renderizadores específicos por tipo de seção
  --------------------------------------------------------------------- */
  function renderTextSection(sec) {
    var $body = $("<div>");
    $("<p>").text(t(sec.content)).appendTo($body);
    return $body;
  }

  function renderParagraphsSection(sec) {
    var $body = $("<div>");
    $.each(sec.paragraphs, function (_, p) {
      $("<p>").text(t(p)).appendTo($body);
    });
    return $body;
  }

  function renderExpertiseSection(sec) {
    var $body = $("<div>", { class: "expertise-grid" });
    $.each(sec.categories, function (_, cat) {
      var $card = $("<div>", { class: "expertise-card" });
      $("<h3>").text(t(cat.name)).appendTo($card);
      $("<p>").text(t(cat.items)).appendTo($card);
      $body.append($card);
    });
    return $body;
  }

  function renderEducationSection(sec) {
    var $body = $("<ul>", { class: "simple-list" });
    $.each(sec.items, function (_, edu) {
      var $li = $("<li>");
      $("<span>", { class: "item-title" }).text(t(edu.degree)).appendTo($li);
      $("<span>", { class: "item-sub" }).text(edu.institution).appendTo($li);
      $body.append($li);
    });
    return $body;
  }

  function renderLanguageSection(sec) {
    var $body = $("<ul>", { class: "simple-list" });
    $.each(sec.items, function (_, lng) {
      var $li = $("<li>");
      var $left = $("<span>");
      $("<span>", { class: "item-title" }).text(t(lng.language) + " — ").appendTo($left);
      $("<span>", { class: "item-desc" }).text(t(lng.level)).appendTo($left);
      $li.append($left);
      $body.append($li);
    });
    return $body;
  }

  function renderExperienceSection(sec) {
    var $body = $("<div>", { class: "timeline" });
    $.each(sec.items, function (_, job) {
      var $item = $("<div>", { class: "timeline-item" });

      $("<div>", { class: "timeline-period" }).text(t(job.period)).appendTo($item);

      var $syntax = $("<div>", { class: "timeline-syntax" });
      $syntax.append($("<div>", { class: "company" }).text(job.company));
      $syntax.append($("<span>", { class: "timeline-tag" }).text(t(job.role)));
      $syntax.append($("<span>", { class: "op" }).text(" "));
      $syntax.append($("<span>", { class: "timeline-tag" }).text(t(job.contractType)));
      
      $item.append($syntax);
      
      var $ul = $("<ul>", { class: "timeline-highlights" });
      $.each(job.highlights, function (_, h) {
        $("<li>").text(t(h)).appendTo($ul);
      });
      $item.append($ul);

      $body.append($item);
    });
    return $body;
  }

  var SECTION_RENDERERS = {
    objective: renderTextSection,
    personalProfile: renderTextSection,
    expertiseAreas: renderExpertiseSection,
    qualificationsSummary: renderParagraphsSection,
    education: renderEducationSection,
    languageProficiency: renderLanguageSection,
    professionalExperience: renderExperienceSection
  };

  /* ---------------------------------------------------------------------
     Renderização de todas as seções como painéis colapsáveis
  --------------------------------------------------------------------- */
  function renderPanels($root, data) {
    var $panels = $root.find(".panels");
    panelIndex = 0;

    $.each(data.sections, function (key, sec) {
      var renderer = SECTION_RENDERERS[key];
      if (!renderer) return;

      var $panel = makePanel(key, t(sec.title));
      var $content = renderer(sec);
      $panel.find(".panel__body").append($content);
      $panels.append($panel);
    });

    bindPanelToggle($panels);
  }

  /** Cada painel abre/fecha de forma independente (não é um acordeão). */
  function bindPanelToggle($panels) {
    $panels.on("click", ".panel__header", function () {
      togglePanel($(this).closest(".panel"));
    });
    $panels.on("keydown", ".panel__header", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePanel($(this).closest(".panel"));
      }
    });
  }

  function togglePanel($panel) {
    var isOpen = $panel.attr("data-open") === "true";
    var key = $panel.attr("data-key");
    $panel.attr("data-open", isOpen ? "false" : "true");
    $panel.find(".panel__header").attr("aria-expanded", String(!isOpen));
    if (key) openState[key] = !isOpen;
  }

  /* ---------------------------------------------------------------------
     Monta (ou remonta, ao trocar de idioma) a página inteira a partir
     dos dados já carregados em RESUME_DATA.
  --------------------------------------------------------------------- */
  function renderAll() {
    var data = RESUME_DATA;
    $("html").attr("lang", LANG);

    var $root = $($("#tpl-root").html().trim());
    renderLangSwitch($root, data);
    renderPrintButton($root);
    renderHeader($root, data);
    renderPanels($root, data);

    $("#app").empty().append($root);
    document.title = 
      data.header.fullName + " — " + t(data.header.title);
  }

  /* ---------------------------------------------------------------------
     Bootstrap: carrega o JSON via AJAX e monta a página
  --------------------------------------------------------------------- */
  $(function () {
    var $app = $("#app");

    $.ajax({
      url: "resume.json",
      dataType: "json",
      cache: false
    })
      .done(function (data) {
        RESUME_DATA = data;
        LANG = (data.language && data.language.default) || "pt-BR";
        renderAll();
      })
      .fail(function (jqXHR, status, err) {
        $app.html(
          '<p class="loading">Não foi possível carregar "resume.json". ' +
          "Se você abriu este arquivo diretamente (file://), sirva a pasta por um servidor " +
          "local (ex.: <code>python -m http.server</code>) para que a requisição AJAX funcione.</p>"
        );
        console.error("Falha ao carregar resume.json:", status, err);
      });
  });
})(jQuery);
