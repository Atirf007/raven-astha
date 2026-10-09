@echo off
echo ========================================================
echo     ASTHA RAVEN - Criador de Instalador Electron
echo ========================================================
echo.
echo Verificando privilegios de administrador...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Privilegios de administrador detectados.
) else (
    echo [ERRO] Por favor, clique com o botao direito neste arquivo e selecione "Executar como Administrador".
    echo Isso e necessario para que o compilador crie atalhos e links simbolicos.
    pause
    exit /b 1
)

echo.
echo [1/3] Instalando dependencias (Isso pode demorar um pouco)...
call npm install --ignore-scripts=false

echo.
echo [2/3] Gerando o Instalador (.exe) via Electron-Builder...
call npm run build

echo.
echo [3/3] Concluido!
echo O instalador do ASTHA RAVEN estara na pasta "dist".
echo.
pause
