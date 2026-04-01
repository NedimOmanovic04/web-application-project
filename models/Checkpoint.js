const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Checkpoint = sequelize.define('Checkpoint', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    scenarioId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'checkpoints',
    timestamps: false
});

module.exports = Checkpoint;
