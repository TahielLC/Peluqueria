export interface TrabajoGaleria {
  id: number;
  titulo: string;
  categoria: 'Corte' | 'Peinado' | 'Barba' | 'Color';
  imagenUrl: string;
}
