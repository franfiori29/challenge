# Belo Challenge

En la rama _main_ del repositorio se encuentra una versión simplificada del challenge en la que expone los dos endpoints pedidos. Por otro lado, en la rama _with/auth_ se agregó registro, login y manejo de balances. Al hacer un swap se actualizan dichos balances y queda un historial de las transacciones.

## Preparación del entorno

Copiar el .env.example

```bash
cp .env.example .env
```

Completar las variables de entorno de Binance. Para obtenerlas se deben crear en la [Testnet de Binance](https://testnet.binance.vision).\
No es necesario cambiar la url de la base de datos ya que está disponible en el docker-compose.yml. Para correrla ejecutar el comando:

```bash
docker-compose up
```

## Instalación

Para proceder a la instalación correr el siguiente comando:

```bash
npm install && npm run db:push
```

## Correr la aplicación

```bash
npm start
```

## Test

```bash
npm run test
```

## Endpoints

La api expone los siguientes endpoints:

### Precio óptimo

```http
GET /optimal
```

Los siguientes son los párametros obligatorios:

| Parámetro | Tipo   | Descripción                 |
| --------- | ------ | --------------------------- |
| symbol    | enum   | BTCUSDT, ETHUSDT, AAVEUSDC  |
| side      | enum   | BUY, SELL                   |
| volume    | number | La cantidad de la operación |

Ejemplo de respuesta:

```json
{
  "price": 6.8403,
  "estimateId": "eab86d55-053e-42f1-ab89-9ed75150e260",
  "expires": "2024-03-06T18:29:17.272Z"
}
```

### Crear órden

```http
POST /order
```

Los siguientes son los párametros obligatorios del body:

| Parámetro  | Tipo   | Descripción |
| ---------- | ------ | ----------- |
| estimateId | string | uuid        |

Ejemplo de respuesta:

```json
{
  "id": "62a1128b-8635-4670-af11-58dd72a56651",
  "total": 6.7205142
}
```

### Consideraciones

- La aplicación da quotes para 3 tipos de swap: BTCUSDT, ETHUSDT y AAVEUSDC.
- Al no estar disponible AAVEUSDC en Binance, se usa como proxy el pair AAVEUSDT en Binance para dar un estimado.
- El precio que devuelve la API expira a los 30 segundos, luego de eso ya no se podrá hacer uso del mismo y se deberá pedir nuevamente. Este parámetro puede ser cambiado en el archivo config.ts. En este mismo también se encuentra el objeto **_symbolsDictionary_** donde se puede setear en cada par el fee, spread, notional y si lo requiere el proxy de otro par de Binance.
