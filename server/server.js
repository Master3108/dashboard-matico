const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Crear carpetas necesarias
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'notebooks');
const METADATA_FILE = path.join(__dirname, 'uploads', 'notebooks_metadata.json');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('[SERVER] Carpeta uploads/notebooks creada');
}

// Inicializar metadata si no existe
if (!fs.existsSync(METADATA_FILE)) {
    fs.writeFileSync(METADATA_FILE, JSON.stringify([], null, 2));
}

// ============================================
// ENDPOINTS API
// ============================================

// Guardar PDF del cuaderno
app.post('/api/save-notebook', (req, res) => {
    try {
        const { 
            email, 
            user_id, 
            session_id, 
            subject, 
            topic, 
            pdf_base64, 
            file_name, 
            scan_id,
            timestamp 
        } = req.body;

        if (!pdf_base64) {
            return res.status(400).json({ 
                success: false, 
                error: 'No se recibió el PDF' 
            });
        }

        // Generar nombre único
        const uniqueId = uuidv4().slice(0, 8);
        const safeFileName = file_name || `matico_scan_${subject || 'materia'}_${uniqueId}.pdf`;
        const filePath = path.join(UPLOADS_DIR, safeFileName);

        // Decodificar y guardar PDF
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        fs.writeFileSync(filePath, pdfBuffer);

        // Guardar metadata
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        const fileRecord = {
            id: uniqueId,
            fileName: safeFileName,
            originalName: file_name,
            email: email || 'anonimo',
            user_id: user_id || 'anonimo',
            session_id: session_id || 1,
            subject: subject || 'Materia',
            topic: topic || 'Tema',
            scan_id: scan_id || uniqueId,
            filePath: `/uploads/notebooks/${safeFileName}`,
            fileSize: pdfBuffer.length,
            createdAt: timestamp || new Date().toISOString(),
            downloaded: false
        };

        metadata.push(fileRecord);
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

        console.log(`[SERVER] PDF guardado: ${safeFileName} (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

        res.json({
            success: true,
            message: 'PDF guardado exitosamente',
            file_path: fileRecord.filePath,
            file_id: uniqueId,
            file_name: safeFileName
        });

    } catch (error) {
        console.error('[SERVER] Error guardando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al guardar el PDF',
            details: error.message
        });
    }
});

// Listar todos los PDFs
app.get('/api/list-notebooks', (req, res) => {
    try {
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        
        // Ordenar por fecha descendente
        const sorted = metadata.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json({
            success: true,
            count: sorted.length,
            files: sorted
        });

    } catch (error) {
        console.error('[SERVER] Error listando PDFs:', error);
        res.status(500).json({
            success: false,
            error: 'Error al listar los PDFs'
        });
    }
});

// Eliminar PDF
app.delete('/api/delete-notebook/:id', (req, res) => {
    try {
        const { id } = req.params;
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        
        const fileIndex = metadata.findIndex(f => f.id === id);
        if (fileIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        const fileRecord = metadata[fileIndex];
        const filePath = path.join(__dirname, fileRecord.filePath);

        // Eliminar archivo físico
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Eliminar de metadata
        metadata.splice(fileIndex, 1);
        fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

        console.log(`[SERVER] PDF eliminado: ${fileRecord.fileName}`);

        res.json({
            success: true,
            message: 'PDF eliminado exitosamente'
        });

    } catch (error) {
        console.error('[SERVER] Error eliminando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el PDF'
        });
    }
});

// Descargar PDF
app.get('/api/download-notebook/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('[SERVER] Error descargando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al descargar el PDF'
        });
    }
});

// Ver PDF (inline)
app.get('/api/view-notebook/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('[SERVER] Error mostrando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al mostrar el PDF'
        });
    }
});

// Stats
app.get('/api/stats', (req, res) => {
    try {
        const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
        
        // Calcular estadísticas
        const stats = {
            totalFiles: metadata.length,
            totalSize: metadata.reduce((acc, f) => acc + (f.fileSize || 0), 0),
            bySubject: {},
            recentUploads: metadata.slice(0, 5)
        };

        metadata.forEach(file => {
            const subject = file.subject || 'Desconocido';
            stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
        });

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// SERVIR FRONTEND (React/Vite build)
// ============================================

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Servir uploads como estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cualquier otra ruta va al frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 MATICO SERVER INICIADO');
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`📁 Uploads: ${UPLOADS_DIR}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('========================================');
    console.log('Endpoints disponibles:');
    console.log('  POST /api/save-notebook    - Guardar PDF');
    console.log('  GET  /api/list-notebooks   - Listar PDFs');
    console.log('  GET  /api/view-notebook/:f - Ver PDF');
    console.log('  GET  /api/download/:f      - Descargar PDF');
    console.log('  DEL  /api/delete-note/:id  - Eliminar PDF');
    console.log('  GET  /api/stats            - Estadísticas');
    console.log('========================================');
});
