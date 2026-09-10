const test = require('node:test');
const assert = require('node:assert');
const {
    stripPlan,
    interlacePixels,
    deinterlacePixels,
    sampleIndices,
    printGeometry,
    fitSize,
    sheetGeometry,
    fitMaskPeriod,
    detectPeriod,
} = require('../interlace.js');

test('stripPlan chia đủ n strip cho một chu kỳ', () => {
    const plan = stripPlan(60, 10, 6);

    assert.deepStrictEqual(plan, [
        { x: 0, w: 10, frame: 0 },
        { x: 10, w: 10, frame: 1 },
        { x: 20, w: 10, frame: 2 },
        { x: 30, w: 10, frame: 3 },
        { x: 40, w: 10, frame: 4 },
        { x: 50, w: 10, frame: 5 },
    ]);
});

test('stripPlan cắt ngắn strip cuối khi width không chia hết', () => {
    const plan = stripPlan(25, 10, 6);

    assert.strictEqual(plan.length, 3);
    assert.deepStrictEqual(plan[2], { x: 20, w: 5, frame: 2 });
});

// ---- helpers ----

function solid(width, height, [r, g, b]) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 255;
    }
    return { width, height, data };
}

function columnColor(img, x) {
    const i = x * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

test('interlacePixels lấy cột theo đúng frame của strip', () => {
    const frames = [
        solid(60, 2, [10, 0, 0]),
        solid(60, 2, [20, 0, 0]),
        solid(60, 2, [30, 0, 0]),
    ];

    const out = interlacePixels(frames, { stripWidth: 10 });

    assert.deepStrictEqual(columnColor(out, 0), [10, 0, 0]);
    assert.deepStrictEqual(columnColor(out, 10), [20, 0, 0]);
    assert.deepStrictEqual(columnColor(out, 20), [30, 0, 0]);
    assert.deepStrictEqual(columnColor(out, 30), [10, 0, 0]);
});

test('deinterlacePixels dựng lại đúng các frame đã interlace', () => {
    const colors = [
        [10, 0, 0],
        [20, 0, 0],
        [30, 0, 0],
        [40, 0, 0],
        [50, 0, 0],
        [60, 0, 0],
    ];
    const frames = colors.map((c) => solid(60, 2, c));

    const back = deinterlacePixels(
        interlacePixels(frames, { stripWidth: 10 }),
        {
            stripWidth: 10,
            n: 6,
        },
    );

    assert.strictEqual(back.length, 6);
    for (let f = 0; f < 6; f++) {
        assert.strictEqual(back[f].width, 10, `frame ${f} phải rộng 10`);
        for (let x = 0; x < 10; x++) {
            assert.deepStrictEqual(
                columnColor(back[f], x),
                colors[f],
                `frame ${f} cột ${x}`,
            );
        }
    }
});

test('sampleIndices rải đều theo bước nhảy để giữ tính loop của GIF', () => {
    // frame cuối kề frame đầu trong loop, nên không lấy cả hai đầu mút
    assert.deepStrictEqual(sampleIndices(12, 6, {}), [0, 2, 4, 6, 8, 10]);
});

test('sampleIndices chỉ lấy trong đoạn được chọn của GIF dài', () => {
    assert.deepStrictEqual(
        sampleIndices(215, 6, { start: 100, length: 12 }),
        [100, 102, 104, 106, 108, 110],
    );
});

test('sampleIndices ping-pong đi hết rồi quay ngược, chạm cả hai đầu mút', () => {
    assert.deepStrictEqual(
        sampleIndices(12, 6, { pingpong: true }),
        [0, 4, 7, 11, 7, 4],
    );
});

test('sampleIndices vẫn trả đủ n index khi GIF ít frame hơn n', () => {
    assert.deepStrictEqual(sampleIndices(3, 6, {}), [0, 0, 1, 1, 2, 2]);
});

test('printGeometry khớp đúng hình học đo được từ assets có sẵn', () => {
    // ball-rotate/minecraft/skull: 3300x2550 @300dpi, strip 10px, chu kỳ 60px
    assert.deepStrictEqual(printGeometry(300, 5, 6), {
        stripWidth: 10,
        actualLpi: 5,
    });
});

test('printGeometry làm tròn strip về số nguyên và báo lại LPI thật đạt được', () => {
    // 300/(12*6) = 4.166 -> strip 4 -> LPI thật 12.5, không phải 12
    assert.deepStrictEqual(printGeometry(300, 12, 6), {
        stripWidth: 4,
        actualLpi: 12.5,
    });
});

test('printGeometry không cho strip nhỏ hơn 1px', () => {
    assert.deepStrictEqual(printGeometry(300, 200, 6), {
        stripWidth: 1,
        actualLpi: 50,
    });
});

test('fitSize thu ảnh vừa khung và bo bề rộng về bội số của chu kỳ strip', () => {
    // 1000px vừa khung nhưng không chia hết cho chu kỳ 60 -> lùi về 960
    assert.deepStrictEqual(fitSize(3300, 2550, 1000, 1000, 60), {
        width: 960,
        height: 742,
    });
});

test('fitSize lấy chiều cao làm ràng buộc khi khung thấp', () => {
    assert.deepStrictEqual(fitSize(100, 100, 90, 50, 7), {
        width: 49,
        height: 49,
    });
});

test('sheetGeometry tái tạo đúng config hand-tuned của commit đầu tiên', () => {
    // img_scale 0.15 với frame 3, d 3 -> chu kỳ mask 9px trên chu kỳ sheet 60px
    assert.deepStrictEqual(sheetGeometry(60, 9, 3), {
        maskPeriod: 9,
        stripWidth: 3,
        scale: 0.15,
    });
});

test('đổi số khe KHÔNG làm đổi kích thước hiển thị', () => {
    const a = sheetGeometry(60, 9, 3);
    const b = sheetGeometry(60, 9, 6);

    assert.strictEqual(b.scale, a.scale, 'scale phải đứng yên khi đổi n');
    assert.strictEqual(b.maskPeriod, a.maskPeriod);
    assert.strictEqual(b.stripWidth, 2, 'chỉ khe hẹp lại');
});

test('sheetGeometry giữ khe trong khoảng 1..chu kỳ-1 để lưới không biến mất', () => {
    assert.strictEqual(sheetGeometry(60, 4, 9).stripWidth, 1); // round(4/9) = 0
    assert.strictEqual(sheetGeometry(60, 4, 1).stripWidth, 3); // round(4/1) = 4, phải chừa bar
});

test('fitMaskPeriod chọn chu kỳ lớn nhất mà ảnh vẫn vừa khung', () => {
    // scale bị chiều cao chặn ở 662/2550 = 0.2596 -> floor(0.2596*60) = 15
    assert.strictEqual(fitMaskPeriod(3300, 2550, 60, 1208, 662), 15);
});

test('fitMaskPeriod không trả về 0 dù khung quá nhỏ', () => {
    assert.strictEqual(fitMaskPeriod(3300, 2550, 60, 60, 60), 2);
});

// lược dọc: mỗi chu kỳ có một vạch đen rộng `bar`, còn lại nền trắng
function comb(width, height, period, bar) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const dark = x % period < bar;
            const i = (y * width + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = dark ? 0 : 255;
            data[i + 3] = 255;
        }
    return { width, height, data };
}

test('detectPeriod tìm đúng chu kỳ của lược tuần hoàn', () => {
    assert.strictEqual(
        detectPeriod(comb(600, 40, 12, 4), { min: 4, max: 40 }),
        12,
    );
});

test('detectPeriod đúng với chu kỳ khác và tỉ lệ vạch khác', () => {
    assert.strictEqual(
        detectPeriod(comb(600, 40, 7, 3), { min: 4, max: 40 }),
        7,
    );
});

test('detectPeriod trả về chu kỳ cơ bản chứ không phải bội của nó', () => {
    const p = detectPeriod(comb(900, 40, 20, 6), { min: 4, max: 90 });
    assert.strictEqual(p, 20, `nhận được ${p}, có thể đã bắt nhầm bội số`);
});
