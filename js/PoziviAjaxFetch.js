const PoziviAjaxFetch = (function () {
    const API_BASE_URL = 'http://localhost:3000/api';

    function makeRequest(method, url, data, callback) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        fetch(url, options)
            .then(response => {
                return response.json().then(body => ({
                    status: response.status,
                    body: body
                }));
            })
            .then(({ status, body }) => {
                callback(status, body);
            })
            .catch(error => {
                console.error('Request error:', error);
                callback(500, { message: 'Greška u komunikaciji sa serverom!' });
            });
    }

    return {
        postScenario: function (title, callback) {
            const url = `${API_BASE_URL}/scenarios`;
            makeRequest('POST', url, { title: title }, callback);
        },

        lockLine: function (scenarioId, lineId, userId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/lines/${lineId}/lock`;
            makeRequest('POST', url, { userId: userId }, callback);
        },

        updateLine: function (scenarioId, lineId, userId, newText, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/lines/${lineId}`;
            makeRequest('PUT', url, { userId: userId, newText: newText }, callback);
        },

        lockCharacter: function (scenarioId, characterName, userId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/characters/lock`;
            makeRequest('POST', url, { userId: userId, characterName: characterName }, callback);
        },

        updateCharacter: function (scenarioId, userId, oldName, newName, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/characters/update`;
            makeRequest('POST', url, { userId: userId, oldName: oldName, newName: newName }, callback);
        },

        getDeltas: function (scenarioId, since, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/deltas?since=${since}`;
            makeRequest('GET', url, null, callback);
        },

        getScenario: function (scenarioId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}`;
            makeRequest('GET', url, null, callback);
        },

        addLine: function (scenarioId, afterLineId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/lines`;
            makeRequest('POST', url, { afterLineId: afterLineId }, callback);
        },

        createCheckpoint: function (scenarioId, userId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/checkpoint`;
            makeRequest('POST', url, { userId: userId }, callback);
        },

        getCheckpoints: function (scenarioId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/checkpoints`;
            makeRequest('GET', url, null, callback);
        },

        restoreCheckpoint: function (scenarioId, checkpointId, callback) {
            const url = `${API_BASE_URL}/scenarios/${scenarioId}/restore/${checkpointId}`;
            makeRequest('GET', url, null, callback);
        }
    };
})();

