const UI = (() => {
    const $ = (id) => document.getElementById(id);
    let el = {};

    function init() {
        [
            'asset',
            'drop',
            'file',
            'status',
            'n',
            'nOut',
            'nLabel',
            'strip',
            'stripOut',
            'stripLabel',
            'showGrating',
            'tradeoff',
            'modeNote',
            'gifRange',
            'start',
            'startOut',
            'len',
            'lenOut',
            'pingpong',
            'sheetCfg',
            'sheetPeriod',
            'rescan',
            'dpi',
            'lpi',
            'inches',
            'printOut',
            'exportImg',
            'exportGrid',
        ].forEach((id) => (el[id] = $(id)));

        el.asset.innerHTML = SHEETS.map(
            (s) =>
                `<option value="${s.file}">${s.file.replace(/\.\w+$/, '')}</option>`,
        ).join('');
        el.asset.onchange = () => loadSheet(el.asset.value);

        el.drop.onclick = () => el.file.click();
        el.file.onchange = () =>
            el.file.files[0] && loadDroppedFile(el.file.files[0]);

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            el.drop.classList.add('over');
        });
        document.addEventListener('dragleave', () =>
            el.drop.classList.remove('over'),
        );
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            el.drop.classList.remove('over');
            const f = e.dataTransfer.files[0];
            if (f) loadDroppedFile(f);
        });

        bind(el.n, (v) => (state.n = v));
        // Thanh này là zoom ở chế độ sheet (chu kỳ mask) và độ rộng khe ở chế độ
        // frames — hai chế độ có đại lượng gốc khác nhau.
        bind(el.strip, (v) => {
            if (state.mode === 'sheet') state.maskPeriod = v;
            else state.stripWidth = v;
            state.userZoomed = true;
        });
        bind(el.start, (v) => (state.rangeStart = v));
        bind(el.len, (v) => (state.rangeLength = v));

        el.showGrating.onchange = () =>
            (state.showGrating = el.showGrating.checked);

        el.pingpong.onchange = () => {
            state.pingpong = el.pingpong.checked;
            rebuild();
            sync();
        };

        el.sheetPeriod.onchange = () =>
            setSheetPeriod(Number(el.sheetPeriod.value), true);
        el.rescan.onclick = () => rescanSheetPeriod();

        [el.dpi, el.lpi, el.inches].forEach((i) => (i.oninput = syncPrint));

        el.exportImg.onclick = () => doExport('image');
        el.exportGrid.onclick = () => doExport('grid');
    }

    function bind(input, apply) {
        input.oninput = () => {
            apply(Number(input.value));
            rebuild();
            sync();
        };
    }

    function doExport(kind) {
        exportPrint(
            kind,
            Number(el.dpi.value),
            Number(el.lpi.value),
            Number(el.inches.value),
        );
    }

    function sync() {
        const isGif = state.mode === 'frames';
        const g = geometry();

        el.status.textContent = state.status;
        el.showGrating.checked = state.showGrating;

        el.nLabel.textContent = isGif ? 'số frame' : 'số khe';
        el.n.value = state.n;
        el.nOut.textContent = state.n;

        el.stripLabel.textContent = isGif ? 'strip (px)' : 'zoom (px)';
        if (isGif) {
            el.strip.min = 1;
            el.strip.max = 12;
            el.strip.value = state.stripWidth;
            el.stripOut.textContent = state.stripWidth + 'px';
        } else {
            el.strip.min = 2;
            el.strip.max = 120;
            el.strip.value = state.maskPeriod;
            el.stripOut.textContent = state.maskPeriod + 'px';
        }

        const bright = Math.round((100 * g.stripWidth) / g.maskPeriod);
        el.tradeoff.textContent =
            `sáng ~${bright}% · kéo ${g.maskPeriod}px là hết một vòng` +
            (isGif && state.n > 10
                ? ' · nhiều frame quá thì tối và mất chi tiết ngang'
                : '');

        el.sheetCfg.hidden = isGif;
        if (isGif) {
            el.modeNote.textContent =
                'interlace do mình dựng — chu kỳ lưới và ảnh luôn khớp';
        } else {
            el.sheetPeriod.value = state.sheetPeriod;
            // Hiện thẳng phép khớp để nhìn là biết đúng hay sai.
            el.modeNote.textContent =
                `${state.sheetPeriod}px × ${g.scale.toFixed(3)} = mask ${g.maskPeriod}px ` +
                `· khe ${g.stripWidth}px`;
        }

        el.gifRange.hidden = !isGif;
        if (isGif) {
            const total = state.baseFrames.length;
            el.start.max = Math.max(0, total - 2);
            el.start.value = state.rangeStart;
            el.startOut.textContent = state.rangeStart;

            el.len.max = total - state.rangeStart;
            el.len.value = state.rangeLength;
            el.lenOut.textContent = `${state.rangeLength}/${total}`;

            el.pingpong.checked = state.pingpong;
        }

        syncPrint();
    }

    function syncPrint() {
        const dpi = Number(el.dpi.value);
        const geo = Interlace.printGeometry(dpi, Number(el.lpi.value), state.n);
        const period = geo.stripWidth * state.n;
        const box = Interlace.fitSize(
            state.srcW,
            state.srcH,
            Math.round(Number(el.inches.value) * dpi),
            1e9,
            period,
        );
        // LPI thật thường lệch LPI nhập vào, vì strip buộc phải là số nguyên pixel.
        el.printOut.textContent =
            `strip ${geo.stripWidth}px · LPI thật ${geo.actualLpi.toFixed(2)} · ` +
            `${box.width}×${box.height}px`;
    }

    return { init, sync };
})();
