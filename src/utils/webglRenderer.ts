/**
 * Complete WebGL renderer with text support via dynamic textures
 * High-performance batched rendering for shapes and text
 */

interface RenderBatch {
  positions: number[]
  colors: number[]
}

interface TextureBatch {
  positions: number[]
  texCoords: number[]
  textureIds: number[]
}

interface TextTexture {
  texture: WebGLTexture
  width: number
  height: number
  lastUsed: number
}

export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null

  // Shape rendering
  private shapeProgram: WebGLProgram | null = null
  private shapePositionBuffer: WebGLBuffer | null = null
  private shapeColorBuffer: WebGLBuffer | null = null

  // Text rendering
  private textProgram: WebGLProgram | null = null
  private textPositionBuffer: WebGLBuffer | null = null
  private textTexCoordBuffer: WebGLBuffer | null = null
  private textCanvas: HTMLCanvasElement
  private textCtx: CanvasRenderingContext2D

  // Batches
  private rectBatch: RenderBatch = { positions: [], colors: [] }
  private lineBatch: RenderBatch = { positions: [], colors: [] }
  private circleBatch: RenderBatch = { positions: [], colors: [] }
  private textBatch: TextureBatch = { positions: [], texCoords: [], textureIds: [] }

  // Text cache
  private textCache = new Map<string, TextTexture>()
  private maxCacheSize = 500

  // Transform state
  private currentTransform: Float32Array | null = null

  constructor(private canvas: HTMLCanvasElement) {
    // Create offscreen canvas for text rendering
    this.textCanvas = document.createElement('canvas')
    this.textCanvas.width = 512
    this.textCanvas.height = 512
    const ctx = this.textCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Failed to create text canvas context')
    this.textCtx = ctx

    this.initWebGL()
  }

  private initWebGL() {
    this.gl = this.canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      preserveDrawingBuffer: false,
    }) || this.canvas.getContext('experimental-webgl') as WebGLRenderingContext

    if (!this.gl) {
      console.warn('WebGL not supported')
      return
    }

    this.initShapeProgram()
    this.initTextProgram()

    // Enable blending
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)

    // Set clear color
    this.gl.clearColor(0.06, 0.09, 0.16, 1.0)
  }

  private initShapeProgram() {
    if (!this.gl) return

    const vertexShaderSource = `
      attribute vec2 aPosition;
      attribute vec4 aColor;
      varying vec4 vColor;
      uniform mat3 uTransform;

      void main() {
        vec3 transformed = uTransform * vec3(aPosition, 1.0);
        gl_Position = vec4(transformed.xy, 0.0, 1.0);
        vColor = aColor;
      }
    `

    const fragmentShaderSource = `
      precision mediump float;
      varying vec4 vColor;

      void main() {
        gl_FragColor = vColor;
      }
    `

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource)
    if (!vertexShader || !fragmentShader) return

    this.shapeProgram = this.gl.createProgram()
    if (!this.shapeProgram) return

    this.gl.attachShader(this.shapeProgram, vertexShader)
    this.gl.attachShader(this.shapeProgram, fragmentShader)
    this.gl.linkProgram(this.shapeProgram)

    if (!this.gl.getProgramParameter(this.shapeProgram, this.gl.LINK_STATUS)) {
      console.error('Shape program link error:', this.gl.getProgramInfoLog(this.shapeProgram))
      return
    }

    this.shapePositionBuffer = this.gl.createBuffer()
    this.shapeColorBuffer = this.gl.createBuffer()
  }

  private initTextProgram() {
    if (!this.gl) return

    const vertexShaderSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      uniform mat3 uTransform;

      void main() {
        vec3 transformed = uTransform * vec3(aPosition, 1.0);
        gl_Position = vec4(transformed.xy, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    `

    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;

      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    `

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource)
    if (!vertexShader || !fragmentShader) return

    this.textProgram = this.gl.createProgram()
    if (!this.textProgram) return

    this.gl.attachShader(this.textProgram, vertexShader)
    this.gl.attachShader(this.textProgram, fragmentShader)
    this.gl.linkProgram(this.textProgram)

    if (!this.gl.getProgramParameter(this.textProgram, this.gl.LINK_STATUS)) {
      console.error('Text program link error:', this.gl.getProgramInfoLog(this.textProgram))
      return
    }

    this.textPositionBuffer = this.gl.createBuffer()
    this.textTexCoordBuffer = this.gl.createBuffer()
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null

    const shader = this.gl.createShader(type)
    if (!shader) return null

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader))
      this.gl.deleteShader(shader)
      return null
    }

    return shader
  }

  public isSupported(): boolean {
    return this.gl !== null && this.shapeProgram !== null && this.textProgram !== null
  }

  public clear() {
    if (!this.gl) return
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  public beginFrame() {
    this.rectBatch = { positions: [], colors: [] }
    this.lineBatch = { positions: [], colors: [] }
    this.circleBatch = { positions: [], colors: [] }
    this.textBatch = { positions: [], texCoords: [], textureIds: [] }
  }

  public setTransform(zoom: number, panX: number, panY: number, rotation: number) {
    if (!this.gl) return

    const width = this.canvas.width
    const height = this.canvas.height
    const centerX = width / 2
    const centerY = height / 2

    const scaleX = (2 / width) * zoom
    const scaleY = (-2 / height) * zoom

    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    const tx = (panX + centerX) * (2 / width) - 1
    const ty = -((panY + centerY) * (2 / height) - 1)

    this.currentTransform = new Float32Array([
      scaleX * cos, -scaleX * sin, 0,
      scaleY * sin, scaleY * cos, 0,
      tx, ty, 1
    ])
  }

  public batchRect(
    x: number, y: number,
    width: number, height: number,
    color: { r: number; g: number; b: number; a: number }
  ) {
    const left = x - width / 2
    const right = x + width / 2
    const top = y - height / 2
    const bottom = y + height / 2

    this.rectBatch.positions.push(
      left, top, right, top, left, bottom,
      right, top, right, bottom, left, bottom
    )

    for (let i = 0; i < 6; i++) {
      this.rectBatch.colors.push(color.r, color.g, color.b, color.a)
    }
  }

  public batchLine(
    x1: number, y1: number,
    x2: number, y2: number,
    color: { r: number; g: number; b: number; a: number },
    lineWidth: number = 2
  ) {
    const dx = x2 - x1
    const dy = y2 - y1
    const angle = Math.atan2(dy, dx)
    const halfWidth = lineWidth / 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const perpX = -sin * halfWidth
    const perpY = cos * halfWidth

    this.lineBatch.positions.push(
      x1 - perpX, y1 - perpY, x2 - perpX, y2 - perpY, x1 + perpX, y1 + perpY,
      x2 - perpX, y2 - perpY, x2 + perpX, y2 + perpY, x1 + perpX, y1 + perpY
    )

    for (let i = 0; i < 6; i++) {
      this.lineBatch.colors.push(color.r, color.g, color.b, color.a)
    }
  }

  public batchCircle(
    x: number, y: number,
    radius: number,
    color: { r: number; g: number; b: number; a: number },
    segments: number = 32
  ) {
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2
      const angle2 = ((i + 1) / segments) * Math.PI * 2
      const x1 = x + Math.cos(angle1) * radius
      const y1 = y + Math.sin(angle1) * radius
      const x2 = x + Math.cos(angle2) * radius
      const y2 = y + Math.sin(angle2) * radius

      this.circleBatch.positions.push(x, y, x1, y1, x2, y2)

      for (let j = 0; j < 3; j++) {
        this.circleBatch.colors.push(color.r, color.g, color.b, color.a)
      }
    }
  }

  public batchText(
    text: string,
    x: number, y: number,
    font: string,
    color: string,
    maxWidth?: number
  ): { width: number; height: number } {
    if (!this.gl) return { width: 0, height: 0 }

    const cacheKey = `${text}|${font}|${color}`
    let textTexture = this.textCache.get(cacheKey)

    if (!textTexture) {
      textTexture = this.createTextTexture(text, font, color, maxWidth)
      this.textCache.set(cacheKey, textTexture)

      // Cleanup old textures if cache is too large
      if (this.textCache.size > this.maxCacheSize) {
        this.cleanupTextCache()
      }
    }

    textTexture.lastUsed = Date.now()

    // Add to batch
    const hw = textTexture.width / 2
    const hh = textTexture.height / 2

    const left = x - hw
    const right = x + hw
    const top = y - hh
    const bottom = y + hh

    this.textBatch.positions.push(
      left, top, right, top, left, bottom,
      right, top, right, bottom, left, bottom
    )

    // Texture coordinates (flip Y for WebGL)
    this.textBatch.texCoords.push(
      0, 0, 1, 0, 0, 1,
      1, 0, 1, 1, 0, 1
    )

    // Store texture reference (will be used during rendering)
    const texIndex = Array.from(this.textCache.keys()).indexOf(cacheKey)
    for (let i = 0; i < 6; i++) {
      this.textBatch.textureIds.push(texIndex)
    }

    return { width: textTexture.width, height: textTexture.height }
  }

  private createTextTexture(text: string, font: string, color: string, maxWidth?: number): TextTexture {
    if (!this.gl) throw new Error('WebGL not initialized')

    this.textCtx.font = font
    this.textCtx.textBaseline = 'middle'
    this.textCtx.textAlign = 'center'

    const metrics = this.textCtx.measureText(text)
    const width = Math.min(maxWidth || metrics.width, this.textCanvas.width)
    const height = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 10

    // Clear and render text
    this.textCtx.clearRect(0, 0, width, height)
    this.textCtx.fillStyle = color
    this.textCtx.fillText(text, width / 2, height / 2, maxWidth)

    // Create WebGL texture
    const texture = this.gl.createTexture()
    if (!texture) throw new Error('Failed to create texture')

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.textCanvas)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)

    return { texture, width, height, lastUsed: Date.now() }
  }

  private cleanupTextCache() {
    if (!this.gl) return

    const entries = Array.from(this.textCache.entries())
    entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed)

    const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2))
    toRemove.forEach(([key, tex]) => {
      this.gl!.deleteTexture(tex.texture)
      this.textCache.delete(key)
    })
  }

  public endFrame() {
    if (!this.gl || !this.currentTransform) return

    // Render shapes
    if (this.lineBatch.positions.length > 0) {
      this.drawShapeBatch(this.lineBatch)
    }
    if (this.rectBatch.positions.length > 0) {
      this.drawShapeBatch(this.rectBatch)
    }
    if (this.circleBatch.positions.length > 0) {
      this.drawShapeBatch(this.circleBatch)
    }

    // Render text
    if (this.textBatch.positions.length > 0) {
      this.drawTextBatch()
    }
  }

  private drawShapeBatch(batch: RenderBatch) {
    if (!this.gl || !this.shapeProgram || !this.currentTransform) return

    this.gl.useProgram(this.shapeProgram)

    const transformLoc = this.gl.getUniformLocation(this.shapeProgram, 'uTransform')
    this.gl.uniformMatrix3fv(transformLoc, false, this.currentTransform)

    const positionLoc = this.gl.getAttribLocation(this.shapeProgram, 'aPosition')
    const colorLoc = this.gl.getAttribLocation(this.shapeProgram, 'aColor')

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapePositionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(batch.positions), this.gl.STREAM_DRAW)
    this.gl.enableVertexAttribArray(positionLoc)
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.shapeColorBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(batch.colors), this.gl.STREAM_DRAW)
    this.gl.enableVertexAttribArray(colorLoc)
    this.gl.vertexAttribPointer(colorLoc, 4, this.gl.FLOAT, false, 0, 0)

    this.gl.drawArrays(this.gl.TRIANGLES, 0, batch.positions.length / 2)
  }

  private drawTextBatch() {
    if (!this.gl || !this.textProgram || !this.currentTransform) return

    this.gl.useProgram(this.textProgram)

    const transformLoc = this.gl.getUniformLocation(this.textProgram, 'uTransform')
    this.gl.uniformMatrix3fv(transformLoc, false, this.currentTransform)

    const positionLoc = this.gl.getAttribLocation(this.textProgram, 'aPosition')
    const texCoordLoc = this.gl.getAttribLocation(this.textProgram, 'aTexCoord')
    const textureLoc = this.gl.getUniformLocation(this.textProgram, 'uTexture')

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textPositionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.textBatch.positions), this.gl.STREAM_DRAW)
    this.gl.enableVertexAttribArray(positionLoc)
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textTexCoordBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.textBatch.texCoords), this.gl.STREAM_DRAW)
    this.gl.enableVertexAttribArray(texCoordLoc)
    this.gl.vertexAttribPointer(texCoordLoc, 2, this.gl.FLOAT, false, 0, 0)

    // Draw each text texture
    const cacheKeys = Array.from(this.textCache.keys())
    const uniqueTextures = new Set(this.textBatch.textureIds)

    uniqueTextures.forEach(texIndex => {
      const key = cacheKeys[texIndex]
      const textTexture = this.textCache.get(key)
      if (!textTexture) return

      this.gl!.activeTexture(this.gl!.TEXTURE0)
      this.gl!.bindTexture(this.gl!.TEXTURE_2D, textTexture.texture)
      this.gl!.uniform1i(textureLoc, 0)

      // Find vertices for this texture
      const indices: number[] = []
      for (let i = 0; i < this.textBatch.textureIds.length; i++) {
        if (this.textBatch.textureIds[i] === texIndex) {
          indices.push(i)
        }
      }

      if (indices.length > 0) {
        this.gl!.drawArrays(this.gl!.TRIANGLES, indices[0], indices.length)
      }
    })
  }

  public dispose() {
    if (!this.gl) return

    if (this.shapePositionBuffer) this.gl.deleteBuffer(this.shapePositionBuffer)
    if (this.shapeColorBuffer) this.gl.deleteBuffer(this.shapeColorBuffer)
    if (this.textPositionBuffer) this.gl.deleteBuffer(this.textPositionBuffer)
    if (this.textTexCoordBuffer) this.gl.deleteBuffer(this.textTexCoordBuffer)
    if (this.shapeProgram) this.gl.deleteProgram(this.shapeProgram)
    if (this.textProgram) this.gl.deleteProgram(this.textProgram)

    this.textCache.forEach(tex => this.gl!.deleteTexture(tex.texture))
    this.textCache.clear()
  }
}

export function hexToRGBA(hex: string, alpha: number = 1): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 1, g: 1, b: 1, a: alpha }

  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
    a: alpha
  }
}
