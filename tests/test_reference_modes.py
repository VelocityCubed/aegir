import unittest,sys,math
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'cad'))
from reference_modes import element_matrices,quadratic_element_matrices

class IndependentElements(unittest.TestCase):
    def test_quadratic_patch_exact_energy_and_mass(self):
        corners=np.array([[0,0,0],[1,0,0],[0,1,0],[0,0,1]],dtype=float)
        xyz=np.array([list(corners)+[(corners[i]+corners[j])/2 for i in range(4) for j in range(i+1,4)]])
        K,M,V=quadratic_element_matrices(xyz)
        np.testing.assert_allclose(K[0]@np.ones(10),0,atol=1e-14)
        self.assertAlmostEqual(np.ones(10)@M[0]@np.ones(10),1/6)
        x2=xyz[0,:,0]**2
        self.assertAlmostEqual(x2@K[0]@x2,4*V[0]/10)
        self.assertAlmostEqual(x2@M[0]@x2,V[0]/35)
        self.assertTrue(np.linalg.eigvalsh(M[0]).min()>0)
    def test_exact_unit_tetrahedron_and_linear_patch(self):
        xyz=np.array([[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]],dtype=float)
        K,M,V=element_matrices(xyz)
        self.assertAlmostEqual(V[0],1/6)
        np.testing.assert_allclose(K[0]@np.ones(4),0,atol=1e-15)
        self.assertAlmostEqual(np.ones(4)@M[0]@np.ones(4),1/6)
        for axis in range(3):
            v=xyz[0,:,axis];self.assertAlmostEqual(v@K[0]@v,1/6)
        self.assertTrue(np.linalg.eigvalsh(M[0]).min()>0)
    def test_orientation_invariance_and_reject_degeneracy(self):
        xyz=np.array([[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]],dtype=float)
        k,m,v=element_matrices(xyz);perm=[1,0,3,2];kp,mp,vp=element_matrices(xyz[:,perm]);np.testing.assert_allclose(kp[0],k[0][perm][:,perm]);np.testing.assert_allclose(mp[0],m[0][perm][:,perm])
        xyz[0,3]=xyz[0,2]
        with self.assertRaisesRegex(ValueError,'Degenerate'):element_matrices(xyz)

if __name__=='__main__':unittest.main()
