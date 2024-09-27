const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const { Readable } = require('stream');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configurar multer para manejar multipart/form-data
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Servidor de OpenAI Backend funcionando.');
});

// Ruta para generar descripción y tags
app.post('/generate', upload.single('image'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'La imagen es requerida.' });
    }

    try {
        const base64Image = file.buffer.toString('base64');
        const imageData = `data:${file.mimetype};base64,${base64Image}`;

        const prompt = [
            {
                type: "text",
                text: "¿Qué hay en esta imagen? Responde en el siguiente formato:\nDescripción: [Tu descripción aquí]\nTags: [etiqueta1, etiqueta2, etiqueta3]"
            },
            {
                type: "image_url",
                image_url: {
                    url: imageData
                }
            }
        ];

        // Enviar el prompt directamente sin serializar a JSON
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.7,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
            }
        );

        const assistantMessage = response.data.choices[0].message.content.trim();

        let lines = assistantMessage.split('\n');
        let description = '';
        let tags = [];

        for (let line of lines) {
            if (line.toLowerCase().startsWith('descripción:')) {
                description = line.substring('descripción:'.length).trim();
            } else if (line.toLowerCase().startsWith('tags:')) {
                tags = line.substring('tags:'.length)
                    .replace(/\[|\]/g, '')
                    .split(',')
                    .map(tag => tag.trim());
            }
        }

        if (!description || tags.length === 0) {
            throw new Error('No se pudo extraer la descripción y los tags de la respuesta de OpenAI.');
        }

        return res.json({ description, tags });
    } catch (error) {
        console.error('Error al llamar a la API de OpenAI:', error.response ? error.response.data : error.message);
        return res.status(500).json({ error: 'Error al generar descripción y tags.' });
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
