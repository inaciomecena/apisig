@echo off
echo Iniciando o Servidor (Backend)...
start "Backend API" cmd /k "cd server && node index.js"

echo Aguardando o servidor iniciar...
timeout /t 5 >nul

echo Iniciando o Cliente (Frontend)...
start "Frontend App" cmd /k "cd client && npm run dev"

echo Aplicacao iniciada!
echo.
echo ======================================================================
echo PARA ACESSAR DE OUTROS COMPUTADORES:
echo Utilize o endereco IP abaixo seguido da porta 3003
echo Exemplo: http://192.168.x.x:3003
echo.
echo Seu(s) IP(s) atual(is):
ipconfig | findstr "IPv4"
echo ======================================================================
echo.
echo O backend deve estar rodando na porta 3002
echo O frontend deve abrir na porta 3003
pause