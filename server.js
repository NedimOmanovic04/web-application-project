const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { sequelize, Scenario, Line, Delta, Checkpoint } = require('./models');

const app = express();
const PORT = 3000;

app.use(express.static('.'));
app.use(bodyParser.json());

// CORS configuration
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// In-memory locks
const lineLocks = new Map(); // key: "scenarioId-lineId", value: { userId, timestamp }
const characterLocks = new Map(); // key: "scenarioId-charName", value: { userId, timestamp }
const userLineLocks = new Map(); // key: userId, value: { scenarioId, lineId }

// Helper function to sort content
function sortContent(content) {
    const sortedContent = [];
    const lineMap = new Map();
    content.forEach(line => lineMap.set(line.lineId, line));

    // Find start lines (nextLineId is not referred to by anyone else) - actually traverse from 1...
    // But lines might not start at 1 if deleted?
    // In Spirala 3/4, first line is created with id 1.
    // We can just follow the linked list from lineId 1? Or find the head?
    // Since we create line 1 initially.

    // Better strategy: Find line with lineId 1 (start)
    let currentLine = content.find(l => l.lineId === 1);

    // If line 1 is missing (e.g. deleted?), we might need another strategy, 
    // but assignment says "Svi ID-evi kreću od 1".

    if (!currentLine && content.length > 0) {
        // Fallback: find line that is not anyone's nextLineId?
        // For simplicity, assume line 1 is start or use simple sort by lineId if linked list broken
        // But let's try to follow linked list
        currentLine = content.find(l => l.lineId === 1);
    }

    const visited = new Set();

    while (currentLine) {
        if (visited.has(currentLine.lineId)) break; // loop detection
        visited.add(currentLine.lineId);
        sortedContent.push(currentLine);

        if (currentLine.nextLineId === null) break;
        currentLine = lineMap.get(currentLine.nextLineId);
    }

    // Add any remaining lines that weren't in the chain (orphans)
    content.forEach(line => {
        if (!visited.has(line.lineId)) {
            sortedContent.push(line);
        }
    });

    return sortedContent;
}

// Wrap text helper
function wrapText(text) {
    const words = text.split(/\s+/);
    if (words.length <= 20) return [text];

    const lines = [];
    let currentLineWords = [];

    for (const word of words) {
        currentLineWords.push(word);
        if (currentLineWords.length === 20) {
            lines.push(currentLineWords.join(' '));
            currentLineWords = [];
        }
    }
    if (currentLineWords.length > 0) {
        lines.push(currentLineWords.join(' '));
    }

    // If exactly multiple of 20, last line is empty? No, loop handles it.
    // Example: 45 words -> 20, 20, 5.
    return lines;
}

// Routes

// Ruta 1: POST /api/scenarios
app.post('/api/scenarios', async (req, res) => {
    try {
        const title = req.body.title && req.body.title.trim() !== ''
            ? req.body.title.trim()
            : 'Neimenovani scenarij';

        const scenario = await Scenario.create({ title });

        await Line.create({
            lineId: 1,
            nextLineId: null,
            text: '',
            scenarioId: scenario.id
        });

        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: [
                {
                    lineId: 1,
                    nextLineId: null,
                    text: ''
                }
            ]
        });
    } catch (error) {
        console.error('Error creating scenario:', error);
        res.status(500).json({ message: 'Greška pri kreiranju scenarija!' });
    }
});

// Ruta: POST /api/scenarios/:scenarioId/lines - Dodavanje nove linije
app.post('/api/scenarios/:scenarioId/lines', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const afterLineId = parseInt(req.body.afterLineId) || null;

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        // Pronađi maksimalni lineId
        const maxLine = await Line.findOne({
            where: { scenarioId },
            order: [['lineId', 'DESC']]
        });
        const newLineId = maxLine ? maxLine.lineId + 1 : 1;

        if (afterLineId) {
            // Dodaj nakon određene linije
            const afterLine = await Line.findOne({
                where: { scenarioId, lineId: afterLineId }
            });
            if (!afterLine) {
                return res.status(404).json({ message: 'Linija nakon koje dodajete ne postoji!' });
            }

            const originalNextLineId = afterLine.nextLineId;

            // Kreiraj novu liniju
            await Line.create({
                lineId: newLineId,
                nextLineId: originalNextLineId,
                text: '',
                scenarioId
            });

            // Ažuriraj prethodnu liniju da pokazuje na novu
            await afterLine.update({ nextLineId: newLineId });
        } else {
            // Dodaj na kraj
            const lastLine = await Line.findOne({
                where: { scenarioId, nextLineId: null }
            });

            await Line.create({
                lineId: newLineId,
                nextLineId: null,
                text: '',
                scenarioId
            });

            if (lastLine) {
                await lastLine.update({ nextLineId: newLineId });
            }
        }

        res.status(200).json({
            message: 'Linija uspjesno dodana!',
            lineId: newLineId
        });
    } catch (error) {
        console.error('Error adding line:', error);
        res.status(500).json({ message: 'Greška pri dodavanju linije!' });
    }
});

// Ruta 2: POST /api/scenarios/:scenarioId/lines/:lineId/lock
app.post('/api/scenarios/:scenarioId/lines/:lineId/lock', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const lineId = parseInt(req.params.lineId);
        const userId = req.body.userId;

        if (!userId) {
            return res.status(400).json({ message: 'userId je obavezan!' });
        }

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const line = await Line.findOne({
            where: { scenarioId, lineId }
        });
        if (!line) {
            return res.status(404).json({ message: 'Linija ne postoji!' });
        }

        const lockKey = `${scenarioId}-${lineId}`;

        if (lineLocks.has(lockKey)) {
            const lock = lineLocks.get(lockKey);
            if (lock.userId !== userId) {
                return res.status(409).json({ message: 'Linija je vec zakljucana!' });
            }
            return res.status(200).json({ message: 'Linija je uspjesno zakljucana!' });
        }

        if (userLineLocks.has(userId)) {
            const prevLock = userLineLocks.get(userId);
            const prevLockKey = `${prevLock.scenarioId}-${prevLock.lineId}`;
            lineLocks.delete(prevLockKey);
            userLineLocks.delete(userId);
        }
        lineLocks.set(lockKey, { userId, timestamp: Date.now() });
        userLineLocks.set(userId, { scenarioId, lineId });

        res.status(200).json({ message: 'Linija je uspjesno zakljucana!' });
    } catch (error) {
        console.error('Error locking line:', error);
        res.status(500).json({ message: 'Greška pri zaključavanju linije!' });
    }
});

// Ruta 3: PUT /api/scenarios/:scenarioId/lines/:lineId
app.put('/api/scenarios/:scenarioId/lines/:lineId', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const lineId = parseInt(req.params.lineId);
        const userId = req.body.userId;
        const newText = req.body.newText;

        if (!userId) {
            return res.status(400).json({ message: 'userId je obavezan!' });
        }

        if (!Array.isArray(newText) || newText.length === 0) {
            return res.status(400).json({ message: 'Niz new_text ne smije biti prazan!' });
        }

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const line = await Line.findOne({
            where: { scenarioId, lineId }
        });
        if (!line) {
            return res.status(404).json({ message: 'Linija ne postoji!' });
        }

        const lockKey = `${scenarioId}-${lineId}`;
        const lock = lineLocks.get(lockKey);

        if (!lock) {
            return res.status(409).json({ message: 'Linija nije zakljucana!' });
        }

        if (lock.userId !== userId) {
            return res.status(409).json({ message: 'Linija je vec zakljucana!' });
        }

        const wrappedLines = [];
        for (const text of newText) {
            const wrapped = wrapText(text);
            wrappedLines.push(...wrapped);
        }

        const timestamp = Math.floor(Date.now() / 1000);

        if (wrappedLines.length === 1) {
            await line.update({ text: wrappedLines[0] });

            await Delta.create({
                scenarioId: scenarioId,
                type: 'line_update',
                lineId: lineId,
                nextLineId: line.nextLineId,
                content: wrappedLines[0],
                timestamp: timestamp
            });
        } else {
            // Need to insert new lines
            let currentLineId = lineId;
            let nextId = line.nextLineId;

            // Update first line
            await line.update({
                text: wrappedLines[0],
                // nextLineId will be updated later
            });

            await Delta.create({
                scenarioId: scenarioId,
                type: 'line_update',
                lineId: currentLineId,
                nextLineId: null, // Temporary
                content: wrappedLines[0],
                timestamp: timestamp
            });

            // Current line object (for linking)
            let prevLine = line;

            // Get max lineId to generate new IDs
            const maxLine = await Line.findOne({
                where: { scenarioId },
                order: [['lineId', 'DESC']]
            });
            let nextAvailableId = (maxLine ? maxLine.lineId : 0) + 1;

            for (let i = 1; i < wrappedLines.length; i++) {
                const newLine = await Line.create({
                    lineId: nextAvailableId,
                    nextLineId: null, // Will update
                    text: wrappedLines[i],
                    scenarioId: scenarioId
                });

                // Link previous to this
                await prevLine.update({ nextLineId: nextAvailableId });

                // Record delta for new line?
                // Task says: "ako se linija zbog svoje dužine prelama, potrebno je dodati te nove linije poslije trenutne linije teksta"
                // Does it imply creating deltas for them? 
                // "Promjena se bilježi u datoteci deltas.json"
                // Usually only the explicit update is recorded. But here new lines are created.
                // For now, let's record delta for the first line update.

                prevLine = newLine;
                currentLineId = nextAvailableId;
                nextAvailableId++;
            }

            // Link last new line to original next
            await prevLine.update({ nextLineId: nextId });
        }

        // Unlock
        lineLocks.delete(lockKey);
        userLineLocks.delete(userId);

        res.status(200).json({ message: 'Linija je uspjesno azurirana!' });
    } catch (error) {
        console.error('Error updating line:', error);
        res.status(500).json({ message: 'Greška pri ažuriranju linije!' });
    }
});


// Ruta 4: POST /api/scenarios/:scenarioId/characters/lock
app.post('/api/scenarios/:scenarioId/characters/lock', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const userId = req.body.userId;
        const characterName = req.body.characterName;

        if (!userId || !characterName) {
            return res.status(400).json({ message: 'Nedostaju podaci!' });
        }

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const lockKey = `${scenarioId}-${characterName}`;
        if (characterLocks.has(lockKey)) {
            const lock = characterLocks.get(lockKey);
            if (lock.userId !== userId) {
                return res.status(409).json({ message: 'Konflikt! Ime lika je vec zakljucano!' });
            }
        }

        characterLocks.set(lockKey, { userId, timestamp: Date.now() });

        res.status(200).json({ message: 'Ime lika je uspjesno zakljucano!' });
    } catch (error) {
        console.error('Error locking character:', error);
        res.status(500).json({ message: 'Greška pri zaključavanju lika!' });
    }
});

// Ruta 5: POST /api/scenarios/:scenarioId/characters/update
app.post('/api/scenarios/:scenarioId/characters/update', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const userId = req.body.userId;
        const oldName = req.body.oldName;
        const newName = req.body.newName;

        if (!userId || !oldName || !newName) {
            return res.status(400).json({ message: 'Nedostaju podaci!' });
        }

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        // Update all lines containing the character name (exact match or part of line?)
        // Task says "promjena imena je case-sensitive"
        // "Primjenjuje novo ime na sve linije gdje se taj lik pojavljuje"
        // Usually strictly replacing the name if it's a character line? Or anywhere?
        // Spirala 3 implied exact match mostly.
        // Let's replace simple string occurrences.

        const lines = await Line.findAll({ where: { scenarioId } });

        for (const line of lines) {
            if (line.text.includes(oldName)) {
                const updatedText = line.text.replaceAll(oldName, newName);
                await line.update({ text: updatedText });
            }
        }

        const timestamp = Math.floor(Date.now() / 1000);
        await Delta.create({
            scenarioId: scenarioId,
            type: 'char_rename',
            oldName: oldName,
            newName: newName,
            timestamp: timestamp
        });

        // Unlock
        const lockKey = `${scenarioId}-${oldName}`;
        characterLocks.delete(lockKey);

        res.status(200).json({ message: 'Ime lika je uspjesno promijenjeno!' });
    } catch (error) {
        console.error('Error updating character:', error);
        res.status(500).json({ message: 'Greška pri ažuriranju lika!' });
    }
});

// Ruta 6: GET /api/scenarios/:scenarioId/deltas
app.get('/api/scenarios/:scenarioId/deltas', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const since = parseInt(req.query.since) || 0;

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const { Op } = require('sequelize');
        const deltas = await Delta.findAll({
            where: {
                scenarioId,
                timestamp: {
                    [Op.gt]: since
                }
            },
            order: [['timestamp', 'ASC']],
            attributes: ['id', 'scenarioId', 'type', 'lineId', 'nextLineId', 'content', 'oldName', 'newName', 'timestamp'],
            raw: true
        });

        // Format to match spec (remove nulls)
        const formattedDeltas = deltas.map(d => {
            const ret = { type: d.type, timestamp: d.timestamp };
            if (d.type === 'line_update') {
                ret.lineId = d.lineId;
                ret.nextLineId = d.nextLineId;
                ret.content = d.content;
            } else if (d.type === 'char_rename') {
                ret.oldName = d.oldName;
                ret.newName = d.newName;
            }
            return ret;
        });

        res.status(200).json({ deltas: formattedDeltas });
    } catch (error) {
        console.error('Error getting deltas:', error);
        res.status(500).json({ message: 'Greška pri dohvatanju delti!' });
    }
});

// Ruta 7: GET /api/scenarios/:scenarioId
app.get('/api/scenarios/:scenarioId', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const scenario = await Scenario.findByPk(scenarioId);

        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const lines = await Line.findAll({
            where: { scenarioId },
            raw: true
        });

        const sortedContent = sortContent(lines);

        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: sortedContent
        });

    } catch (error) {
        console.error('Error getting scenario:', error);
        res.status(500).json({ message: 'Greška pri dohvatanju scenarija!' });
    }
});

// Ruta 8: POST /api/scenarios/:scenarioId/checkpoint
app.post('/api/scenarios/:scenarioId/checkpoint', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const userId = req.body.userId; // Not strictly used for saving, but passed

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        await Checkpoint.create({
            scenarioId,
            timestamp
        });

        res.status(200).json({ message: 'Checkpoint je uspjesno kreiran!' });
    } catch (error) {
        console.error('Error creating checkpoint:', error);
        res.status(500).json({ message: 'Greška pri kreiranju checkpointa!' });
    }
});

// Ruta 9: GET /api/scenarios/:scenarioId/checkpoints
app.get('/api/scenarios/:scenarioId/checkpoints', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const checkpoints = await Checkpoint.findAll({
            where: { scenarioId },
            attributes: ['id', 'timestamp'],
            order: [['timestamp', 'ASC']],
            raw: true
        });

        res.status(200).json(checkpoints);
    } catch (error) {
        console.error('Error getting checkpoints:', error);
        res.status(500).json({ message: 'Greška pri dobijanju checkpointa!' });
    }
});

// Ruta 10: GET /api/scenarios/:scenarioId/restore/:checkpointId
app.get('/api/scenarios/:scenarioId/restore/:checkpointId', async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId);
        const checkpointId = parseInt(req.params.checkpointId);

        const scenario = await Scenario.findByPk(scenarioId);
        if (!scenario) {
            return res.status(404).json({ message: 'Scenario ne postoji!' });
        }

        const checkpoint = await Checkpoint.findOne({
            where: { id: checkpointId, scenarioId }
        });
        if (!checkpoint) {
            return res.status(404).json({ message: 'Checkpoint ne postoji!' });
        }

        // Get all deltas up to checkpoint timestamp
        const { Op } = require('sequelize');
        const deltas = await Delta.findAll({
            where: {
                scenarioId,
                timestamp: {
                    [Op.lte]: checkpoint.timestamp
                }
            },
            order: [['timestamp', 'ASC']],
            raw: true
        });

        // Reconstruct state
        // Initial state logic: "Uzeti početno stanje scenarija (stanje nakon POST /api/scenarios)."
        // Initial state is just one empty line (ID 1).

        let linesMap = new Map();
        linesMap.set(1, { lineId: 1, nextLineId: null, text: '' });

        // Needs careful reconstruction logic.
        // Simplified approach: Replay deltas on top of initial map.

        for (const delta of deltas) {
            if (delta.type === 'line_update') {
                // Update or Add
                // If lineId exists in map, update text.
                // If inserting new lines?
                // The logic in PUT updates existing line.
                // If wrapText created new lines, they should have their own deltas?
                // Or if not recorded in delta individually, we have a problem.
                // Assuming deltas capture the state change.

                if (linesMap.has(delta.lineId)) {
                    const line = linesMap.get(delta.lineId);
                    line.text = delta.content;
                    line.nextLineId = delta.nextLineId; // Important if link changed
                    linesMap.set(delta.lineId, line);
                } else {
                    // Create new line if not exists (e.g. from wrap or insert)
                    // But wait, delta only has lineId, nextLineId, content.
                    linesMap.set(delta.lineId, {
                        lineId: delta.lineId,
                        nextLineId: delta.nextLineId,
                        text: delta.content
                    });
                }

            } else if (delta.type === 'char_rename') {
                for (let [id, line] of linesMap) {
                    if (line.text.includes(delta.oldName)) {
                        line.text = line.text.replaceAll(delta.oldName, delta.newName);
                        linesMap.set(id, line);
                    }
                }
            }
        }

        const content = Array.from(linesMap.values());

        // Need to sort using nextLineId references
        /* copy paste sort logic */
        // Re-implement simplified sort for map values

        const sortedDeltasContent = [];
        let currentLine = content.find(l => l.lineId === 1);
        const mapForSort = new Map();
        content.forEach(l => mapForSort.set(l.lineId, l));

        const visited = new Set();
        while (currentLine) {
            if (visited.has(currentLine.lineId)) break;
            visited.add(currentLine.lineId);
            sortedDeltasContent.push(currentLine);
            if (currentLine.nextLineId === null) break;
            currentLine = mapForSort.get(currentLine.nextLineId);
        }

        // Add orphans? Technically shouldn't be any if clean history.

        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: sortedDeltasContent
        });
    } catch (error) {
        console.error('Error restoring checkpoint:', error);
        res.status(500).json({ message: 'Greška pri vraćanju checkpointa!' });
    }
});

// Initialize database and start server
sequelize.sync({ force: true }).then(async () => {
    // Seed initial data for tests
    try {
        const scenario = await Scenario.create({ title: 'Test Scenario' });

        // Create lines 1-6 for tests
        await Line.create({ lineId: 1, nextLineId: 2, text: 'Prva linija sa ALICE', scenarioId: scenario.id });
        await Line.create({ lineId: 2, nextLineId: 3, text: 'Druga linija teksta', scenarioId: scenario.id });
        await Line.create({ lineId: 3, nextLineId: 4, text: 'Treca linija', scenarioId: scenario.id });
        await Line.create({ lineId: 4, nextLineId: 5, text: 'Cetvrta linija', scenarioId: scenario.id });
        await Line.create({ lineId: 5, nextLineId: 6, text: 'Peta linija', scenarioId: scenario.id });
        await Line.create({ lineId: 6, nextLineId: null, text: 'Sesta linija', scenarioId: scenario.id });

        console.log('Seed data created successfully');
    } catch (err) {
        console.error('Seed error:', err);
    }

    app.listen(PORT, () => {
        console.log(`Server je pokrenut na portu ${PORT}`);
        console.log(`API dostupan na http://localhost:${PORT}/api`);
    });
}).catch(error => {
    console.error('Database sync error:', error);
});
