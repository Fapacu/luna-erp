(() => {
    function labelTable(table) {
        const headers = Array.from(table.tHead?.rows[0]?.cells || []);
        if (!headers.length) return;

        const labels = headers.map((header, index) => {
            const text = header.textContent.replace(/\s+/g, " ").trim();
            return text || (index === headers.length - 1 ? "Acciones" : "Dato");
        });

        table.classList.add("responsive-list");
        table.parentElement?.classList.add("responsive-list-wrapper");

        table.querySelectorAll("tbody tr").forEach((row) => {
            const cells = Array.from(row.cells);
            if (cells.length === 1 && cells[0].colSpan > 1) return;

            cells.forEach((cell, index) => {
                if (cell.colSpan > 1) return;
                let label = labels[index] || "Dato";
                if ((!headerHasText(headers[index])) && cell.querySelector("button, a")) {
                    label = "Acciones";
                }
                cell.dataset.label = label;
            });
        });
    }

    function headerHasText(header) {
        return Boolean(header?.textContent.replace(/\s+/g, " ").trim());
    }

    function prepareTables() {
        document.querySelectorAll("table").forEach((table) => {
            if (!table.tHead || table.dataset.responsiveObserver) return;
            table.dataset.responsiveObserver = "true";
            labelTable(table);

            const bodyObserver = new MutationObserver(() => labelTable(table));
            Array.from(table.tBodies).forEach((body) => {
                bodyObserver.observe(body, { childList: true, subtree: true });
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", prepareTables, { once: true });
    } else {
        prepareTables();
    }
})();
