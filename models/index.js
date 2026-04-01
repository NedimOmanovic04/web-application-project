const sequelize = require('../config/database');
const Scenario = require('./Scenario');
const Line = require('./Line');
const Delta = require('./Delta');
const Checkpoint = require('./Checkpoint');

Scenario.hasMany(Line, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Line.belongsTo(Scenario, { foreignKey: 'scenarioId' });

Scenario.hasMany(Delta, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Delta.belongsTo(Scenario, { foreignKey: 'scenarioId' });

Scenario.hasMany(Checkpoint, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Checkpoint.belongsTo(Scenario, { foreignKey: 'scenarioId' });

module.exports = {
    sequelize,
    Scenario,
    Line,
    Delta,
    Checkpoint
};
